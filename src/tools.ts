/**
 * MCP tool definitions for the Green Invoice API.
 * Consolidated resource-based tools over the Green Invoice / Morning REST API.
 *
 * DISCLAIMER: This is an unofficial, third-party integration.
 * Not affiliated with or endorsed by Green Invoice.
 *
 * API Reference: https://developers.morning.co/api
 * OpenAPI spec: https://developers.morning.co/docs/openapi.bundled.json
 * (snapshot in spec/, checked against the live API 2026-10-28)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GreenInvoiceClient, SANDBOX_BASE } from "./client.js";

// ── Shared helpers ─────────────────────────────────────────────────────

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function parseData(raw?: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in 'data' parameter: ${raw}`);
  }
}

// ── Reference enums (embedded in descriptions) ────────────────────────

const DOC_TYPES = `Document type codes (per GET /documents/types): 10=Price Quotation, 20=Bill/Payment Confirmation, 100=Order (sales order/order confirmation), 200=Delivery Note, 210=Return Delivery, 300=Proforma Invoice (חשבון עסקה), 305=Tax Invoice, 320=Tax Invoice+Receipt, 330=Credit Note, 400=Receipt, 405=Donation Receipt, 410=Cancel Donation, 500=Purchase Order (הזמנת רכש, issued to a supplier), 600=Deposit Receipt, 610=Deposit Withdrawal. There is no RFQ document type (price quotations are outbound only).`;

const DOC_STATUSES = `Document statuses: 0=Open, 1=Closed, 2=Manually Closed, 3=Canceling, 4=Canceled`;

const PAYMENT_TYPES = `Payment type codes: -1=Unpaid, 0=Deduction at Source, 1=Cash, 2=Check, 3=Credit Card, 4=Bank Transfer, 5=PayPal, 10=Payment App, 11=Other`;

const WEBHOOK_SETTINGS_URL = "https://app.greeninvoice.co.il/settings/developers/webhooks";

// From the official spec's Webhooks section (2026-10-28).
const WEBHOOK_EVENTS = [
  { topic: "document/created", when: "A document is created." },
  { topic: "client/created", when: "A client is created." },
  { topic: "supplier/created", when: "A supplier is created." },
  { topic: "payment/received", when: "A payment is received." },
  { topic: "sale-pages/page-contacted", when: "A visitor submits their contact details on a sale page." },
  { topic: "sale-pages/order-paid", when: "An order is paid on a sale page." },
  { topic: "expense-draft/parsed", when: "An uploaded expense draft finishes parsing." },
  { topic: "expense-draft/declined", when: "An uploaded expense draft is declined." },
  { topic: "expense/file-updated", when: "An expense's file is updated." },
  { topic: "file/infected", when: "An uploaded file is found to be infected and quarantined." },
];

const CURRENCIES = `Currencies: ILS, USD, EUR, GBP, JPY, CHF, CNY, AUD, CAD, and more (28 supported)`;

// ── Sandbox test-data helpers ─────────────────────────────────────────

/** Document types the API rejects without a payment array. */
const PAYMENT_REQUIRED_TYPES = new Set([320, 400, 405]);

const TEST_REMARKS =
  "TEST DATA — created in the Green Invoice sandbox by greeninvoice-mcp. Not a real financial document.";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Expand a minimal spec into a complete, valid document payload.
 *
 * Everything has a default so `create_test_document` works with no arguments at
 * all; every default can be overridden. Callers wanting full control over the
 * body should use the `create_document` action instead.
 */
export function buildTestDocument(data: Record<string, unknown> = {}): Record<string, unknown> {
  const type = Number(data.type ?? 305);
  const price = Number(data.price ?? 100);
  const quantity = Number(data.quantity ?? 1);
  const currency = (data.currency as string) ?? "ILS";
  const date = (data.date as string) ?? today();

  const doc: Record<string, unknown> = {
    type,
    date,
    lang: (data.lang as string) ?? "en",
    currency,
    description: (data.description as string) ?? `TEST document (type ${type})`,
    remarks: (data.remarks as string) ?? TEST_REMARKS,
    client: {
      name: (data.clientName as string) ?? "MCP Sandbox Test Client",
      add: data.addClient === false ? false : true,
      ...(data.clientEmails ? { emails: data.clientEmails } : {}),
      ...(data.clientTaxId ? { taxId: data.clientTaxId } : {}),
    },
    income: [
      {
        description: (data.itemDescription as string) ?? "Test line item",
        quantity,
        price,
        currency,
        vatType: Number(data.vatType ?? 0),
      },
    ],
  };

  if (data.dueDate) doc.dueDate = data.dueDate;

  if (PAYMENT_REQUIRED_TYPES.has(type)) {
    // Defaults to the line subtotal. With vatType 0 the document total includes
    // VAT on top, so this leaves the document partially paid rather than closed
    // — pass paymentAmount explicitly to settle it in full.
    doc.payment = [
      {
        date,
        type: Number(data.paymentType ?? 4),
        price: Number(data.paymentAmount ?? price * quantity),
        currency,
      },
    ];
  }

  return doc;
}

/** Document types the `seed` action creates, one of each. */
export const SEED_TYPES = [10, 300, 305, 320, 400];

// ════════════════════════════════════════════════════════════════════════

export function registerTools(
  server: McpServer,
  client: GreenInvoiceClient,
  sandboxClient: GreenInvoiceClient | null = null
) {

  // ── 1. ACCOUNT ───────────────────────────────────────────────────────

  server.tool(
    "account",
    `Get account information (GET /account/me). Not in the official spec, and it answers 403 for API-key auth on the accounts tested (verified 2026-10-28); use business "get" for the business profile instead.
Actions: "get" = account info. ("settings" was removed in 0.5.0: GET /account/settings is 404, no such route.)`,
    {
      action: z.enum(["get"]).describe("Action to perform"),
    },
    async () => {
      return json(await client.get("/account/me"));
    }
  );

  // ── 2. BUSINESS ──────────────────────────────────────────────────────

  server.tool(
    "business",
    `Manage businesses. Actions:
"list" = list all user businesses (GET /businesses)
"get" = get current business (GET /businesses/me) or by id (data: {"id":"..."})
"update" = update business (data: JSON of fields to update)
"get_numbering" = get document numbering (GET /businesses/numbering)
"set_numbering" = set initial numbering (data: {"10":1,"305":50001,...})
"get_footer" = get document footer text
"get_types" = get business types (data: {"lang":"he"} optional)
"upload_file" = upload logo/signature/doc (data: {"type":"logo","file":"base64..."})
"delete_file" = delete a file (data: {"type":"logo"})`,
    {
      action: z.enum(["list", "get", "update", "get_numbering", "set_numbering", "get_footer", "get_types", "upload_file", "delete_file"])
        .describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters (see action descriptions)"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      switch (action) {
        case "list":
          return json(await client.get("/businesses"));
        case "get": {
          const id = data?.id as string | undefined;
          return json(await client.get(id ? `/businesses/${id}` : "/businesses/me"));
        }
        case "update":
          return json(await client.put("/businesses", data));
        case "get_numbering":
          return json(await client.get("/businesses/numbering"));
        case "set_numbering":
          return json(await client.put("/businesses/numbering", data));
        case "get_footer":
          return json(await client.get("/businesses/footer"));
        case "get_types": {
          const lang = data?.lang ? `?lang=${data.lang}` : "";
          return json(await client.get(`/businesses/types${lang}`));
        }
        case "upload_file":
          return json(await client.post("/businesses/file", data));
        case "delete_file":
          return json(await client.request("DELETE", "/businesses/file", data));
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 3. DOCUMENT ──────────────────────────────────────────────────────

  server.tool(
    "document",
    `Manage documents (invoices, receipts, quotes, etc.). ${DOC_TYPES}. ${DOC_STATUSES}. ${PAYMENT_TYPES}. ${CURRENCIES}.

Actions:
"search" = search documents (data: {page, pageSize, type:[], status:[], fromDate, toDate, sort, clientId, clientName, description, number, paymentTypes:[], download})
"get" = get by ID (data: {"id":"..."})
"create" = create document (works for ALL types above, incl. 100=Order and 500=Purchase Order). IMPORTANT field names: 'income' (not 'items'), 'payment' (not 'payments'), 'remarks' (not 'notes'), 'lang' (not 'language'), 'emails' (array). Types 320,400,405 REQUIRE payment array. Set client.add=true to auto-create client. For type 500 the 'client' object holds the SUPPLIER being ordered from (document recipient); manage supplier records themselves with the 'supplier' tool. Data: {type, client:{id,name,emails,taxId,address,city,zip,country,phone,add,self}, income:[{catalogNum,description,quantity,price,currency,vatType,itemId}], payment:[{date,type,price,currency,bankName,bankBranch,bankAccount,chequeNum}], currency,lang,description,remarks,footer,emailContent,signed,rounding,attachment,date,dueDate,discount:{amount,type},maxPayments,linkedDocumentIds,linkedPaymentId}
"update" = update document (data: {"id":"...", ...fields}). PUT /documents/{id} is not in the official spec and is unverified; issued tax documents generally cannot be changed (cancel with a credit note, 330).
"close" = close document (data: {"id":"..."})
"open" = reopen document (data: {"id":"..."})
"download_links" = get PDF download links (data: {"id":"..."})
"preview" = preview as base64 PDF (data: same shape as create)
"get_linked" = get linked documents (data: {"id":"..."})
"get_info" = get document info for a type (data: {"type":305})
"get_types" = list document types (data: {"lang":"he"} optional)
"get_statuses" = list document statuses (data: {"lang":"he"} optional)
"search_payments" = search payments within documents (data: {page, pageSize, type:[], paymentTypes:[], fromDate, toDate, paymentId, sort})

Emailing and payments (0.5.0): the API has no separate send or add-payment call (POST /documents/{id}/send and /documents/{id}/payment are 404, no such route, verified 2026-10-28). To email a document, put addresses in client.emails on "create" (the download link goes to them; emailContent and attachment control the mail). To record payment against an invoice, create a receipt (400) with payment rows and linkedDocumentIds:[invoiceId]. To share an existing document, use "download_links".`,
    {
      action: z.enum(["search", "get", "create", "update", "close", "open", "download_links", "preview", "get_linked", "get_info", "get_types", "get_statuses", "search_payments"])
        .describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      const id = data?.id as string | undefined;
      switch (action) {
        case "search":
          return json(await client.post("/documents/search", data));
        case "get":
          return json(await client.get(`/documents/${id}`));
        case "create": {
          const body = { ...data };
          delete body.id;
          return json(await client.post("/documents", body));
        }
        case "update": {
          const body = { ...data };
          delete body.id;
          return json(await client.put(`/documents/${id}`, body));
        }
        case "close":
          return json(await client.post(`/documents/${id}/close`));
        case "open":
          return json(await client.post(`/documents/${id}/open`));
        case "download_links":
          return json(await client.get(`/documents/${id}/download/links`));
        case "preview":
          return json(await client.post("/documents/preview", data));
        case "get_linked":
          return json(await client.get(`/documents/${id}/linked`));
        case "get_info": {
          const type = data?.type;
          return json(await client.get(`/documents/info?type=${type}`));
        }
        case "get_types": {
          const lang = data?.lang ? `?lang=${data.lang}` : "";
          return json(await client.get(`/documents/types${lang}`));
        }
        case "get_statuses": {
          const lang = data?.lang ? `?lang=${data.lang}` : "";
          return json(await client.get(`/documents/statuses${lang}`));
        }
        case "search_payments":
          return json(await client.post("/documents/payments/search", data));
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 4. CLIENT ────────────────────────────────────────────────────────

  server.tool(
    "client",
    `Manage clients. Actions:
"search" = search clients (data: {page, pageSize, name, email, taxId, active, contactPerson, labels:[], sort, sortType})
"get" = get by ID (data: {"id":"..."})
"create" = create client (data: {name, emails:[], taxId, phone, mobile, fax, city, zip, address, country, category, subCategory, accountingKey, paymentTerms, bankName, bankBranch, bankAccount, active, department, contactPerson, remarks, labels:[]})
"update" = update client (data: {"id":"...", ...fields})
"delete" = delete client (NOTE: only inactive clients can be deleted) (data: {"id":"..."})
"associate_docs" = associate existing documents to a client (data: {"id":"...", "ids":["docId1","docId2"]})
"merge" = merge clients (one must be inactive; inactive one is deleted) (data: {"id":"...", "mergeId":"..."})
"update_balance" = update/reset client balance (data: {"id":"...", "balance":0})`,
    {
      action: z.enum(["search", "get", "create", "update", "delete", "associate_docs", "merge", "update_balance"])
        .describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      const id = data?.id as string | undefined;
      switch (action) {
        case "search":
          return json(await client.post("/clients/search", data));
        case "get":
          return json(await client.get(`/clients/${id}`));
        case "create": {
          const body = { ...data };
          delete body.id;
          return json(await client.post("/clients", body));
        }
        case "update": {
          const body = { ...data };
          delete body.id;
          return json(await client.put(`/clients/${id}`, body));
        }
        case "delete":
          return json(await client.delete(`/clients/${id}`));
        case "associate_docs": {
          const ids = data?.ids;
          return json(await client.post(`/clients/${id}/assoc`, { ids }));
        }
        case "merge": {
          const mergeId = data?.mergeId;
          return json(await client.post(`/clients/${id}/merge`, { mergeId }));
        }
        case "update_balance": {
          const balance = data?.balance;
          return json(await client.post(`/clients/${id}/balance`, { balance }));
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 5. SUPPLIER ──────────────────────────────────────────────────────

  server.tool(
    "supplier",
    `Manage suppliers (used for expenses). Actions:
"search" = search suppliers (data: {page, pageSize, name, email, active, contactPerson, labels:[]})
"get" = get by ID (data: {"id":"..."})
"create" = create supplier (data: {name, emails:[], taxId, phone, mobile, fax, city, zip, address, country, department, accountingKey, paymentTerms, bankName, bankBranch, bankAccount, active, contactPerson, remarks, labels:[]})
"update" = update supplier (data: {"id":"...", ...fields})
"delete" = delete supplier (NOTE: only inactive suppliers can be deleted) (data: {"id":"..."})
"merge" = merge suppliers (one must be inactive) (data: {"id":"...", "mergeId":"..."})`,
    {
      action: z.enum(["search", "get", "create", "update", "delete", "merge"])
        .describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      const id = data?.id as string | undefined;
      switch (action) {
        case "search":
          return json(await client.post("/suppliers/search", data));
        case "get":
          return json(await client.get(`/suppliers/${id}`));
        case "create": {
          const body = { ...data };
          delete body.id;
          return json(await client.post("/suppliers", body));
        }
        case "update": {
          const body = { ...data };
          delete body.id;
          return json(await client.put(`/suppliers/${id}`, body));
        }
        case "delete":
          return json(await client.delete(`/suppliers/${id}`));
        case "merge": {
          const mergeId = data?.mergeId;
          return json(await client.post(`/suppliers/${id}/merge`, { mergeId }));
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 6. ITEM ──────────────────────────────────────────────────────────

  server.tool(
    "item",
    `Manage catalog items (products/services). Actions:
"search" = search items (data: {page, pageSize, name, description, currency, active})
"get" = get by ID (data: {"id":"..."})
"create" = create item (data: {name, description, price, currency, vatType (0=default,1=included,2=exempt), sku, active})
"update" = update item (data: {"id":"...", ...fields})
"delete" = delete item (data: {"id":"..."})`,
    {
      action: z.enum(["search", "get", "create", "update", "delete"])
        .describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      const id = data?.id as string | undefined;
      switch (action) {
        case "search":
          return json(await client.post("/items/search", data));
        case "get":
          return json(await client.get(`/items/${id}`));
        case "create": {
          const body = { ...data };
          delete body.id;
          return json(await client.post("/items", body));
        }
        case "update": {
          const body = { ...data };
          delete body.id;
          return json(await client.put(`/items/${id}`, body));
        }
        case "delete":
          return json(await client.delete(`/items/${id}`));
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 7. EXPENSE ───────────────────────────────────────────────────────

  server.tool(
    "expense",
    `Manage expenses (outcome tracking). ${PAYMENT_TYPES}.
Expense statuses: 10=Open, 20=Reported.
Expense documentType uses the same document-type codes as documents (NOT a 10/20/30/40 enum): e.g. 305=Tax Invoice, 320=Tax Invoice+Receipt (חשבונית מס קבלה), 400=Receipt, 300=Proforma. Verified 2026-07-24: passing 30 fails with 3308 "invalid expense document type"; 320 works.
IMPORTANT create requirements (verified 2026-07-24): reportingDate is required (else 3308->3310 "invalid reporting month"); accountingClassification is required (else 3312 "please fill in expense type details") — get valid ids/keys via get_classifications.

Actions:
"search" = search expenses (data: {page, pageSize, fromDate, toDate, dueDate, description, supplierId, supplierName, number, paid, reported, sort, minAmount, maxAmount, accountingClassificationId})
"get" = get by ID (data: {"id":"..."})
"create" = create expense (data: {paymentType, currency, currencyRate, vat, amount, date, dueDate, reportingDate, documentType, number, description, remarks, supplier:{id,name,...}, accountingClassification:{id,key,code,title,...}, active, addRecipient, addAccountingClassification})
"update" = update expense (data: {"id":"...", ...fields}). NOTE: cannot update once reported (status=20)
"delete" = delete expense (data: {"id":"..."})
"open" = reopen expense (data: {"id":"..."})
"close" = close/report expense (data: {"id":"..."})
"get_statuses" = list expense statuses
"get_classifications" = get accounting classifications map
"search_drafts" = search expense drafts (data: {page, pageSize, fromDate, toDate, description, supplierId, supplierName})
"upload_file" = upload a bill/receipt (PDF, PNG, JPG, GIF, SVG; max 16 MB) (data: {filename, contentType?, file?:"<base64>", url?:"https://... to fetch the file from", expenseId?}). Without expenseId Green Invoice OCRs the file and creates an expense DRAFT asynchronously (5-60 s; find it with search_drafts; a human approves it in the app). With expenseId the file is attached to that expense (poll get until data.fileKey is set). Give exactly one of file/url. Reported expenses (status 20) can't get files.`,
    {
      action: z.enum(["search", "get", "create", "update", "delete", "open", "close", "get_statuses", "get_classifications", "search_drafts", "upload_file"])
        .describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      const id = data?.id as string | undefined;
      switch (action) {
        case "search":
          return json(await client.post("/expenses/search", data));
        case "get":
          return json(await client.get(`/expenses/${id}`));
        case "create": {
          const body = { ...data };
          delete body.id;
          return json(await client.post("/expenses", body));
        }
        case "update": {
          const body = { ...data };
          delete body.id;
          return json(await client.put(`/expenses/${id}`, body));
        }
        case "delete":
          return json(await client.delete(`/expenses/${id}`));
        case "open":
          return json(await client.post(`/expenses/${id}/open`));
        case "close":
          return json(await client.post(`/expenses/${id}/close`));
        case "get_statuses":
          return json(await client.get("/expenses/statuses"));
        case "get_classifications":
          return json(await client.get("/accounting/classifications/map"));
        case "search_drafts":
          return json(await client.post("/expenses/drafts/search", data));
        case "upload_file": {
          const d = (data ?? {}) as Record<string, unknown>;
          const name = String(d.filename ?? "").trim();
          if (!name) throw new Error("upload_file needs data.filename");
          if (Boolean(d.file) === Boolean(d.url)) throw new Error("upload_file needs exactly one of data.file (base64) or data.url");
          let bytes: Uint8Array;
          let type = (d.contentType as string) || "";
          if (d.url) {
            const r = await fetch(String(d.url));
            if (!r.ok) throw new Error(`Fetching data.url failed (${r.status})`);
            bytes = new Uint8Array(await r.arrayBuffer());
            type = type || r.headers.get("content-type") || "";
          } else {
            bytes = Uint8Array.from(Buffer.from(String(d.file), "base64"));
          }
          if (!type) {
            const ext = name.toLowerCase().split(".").pop();
            type = ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml" } as Record<string, string>)[ext ?? ""] || "application/octet-stream";
          }
          // Unique name per upload: S3 keys dedupe on identical names.
          const dot = name.lastIndexOf(".");
          const unique = dot > 0
            ? `${name.slice(0, dot)}_${Date.now().toString(36)}${name.slice(dot)}`
            : `${name}_${Date.now().toString(36)}`;
          const res = await client.uploadExpenseFile({
            bytes, filename: unique, contentType: type, expenseId: d.expenseId as string | undefined,
          });
          return json({
            ...res,
            bytes: bytes.byteLength,
            next: d.expenseId
              ? "Poll expense get until data.fileKey is set (5-15 s)."
              : "OCR runs asynchronously; poll search_drafts (newest first) for the new draft. Approve it in Green Invoice.",
          });
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 8. PAYMENT ───────────────────────────────────────────────────────

  server.tool(
    "payment",
    `Collect payments: hosted payment forms and saved credit-card tokens. ${PAYMENT_TYPES}.

Actions:
"get_form" = get payment form URL for online payment (data: {type, description, lang, currency, vatType, amount, maxPayments, pluginId, group, client:{...}, income:[...], remarks, successUrl, failureUrl, notifyUrl, custom})
"search_tokens" = search saved credit card tokens (data: {paymentNumber, cardHolder, externalKey})
"charge_token" = charge a saved credit card token (data: {"id":"tokenId", type, description, lang, currency, vatType, amount, maxPayments, income:[...], remarks, notifyUrl})

Payment links (create_link/get_link/get_link_status) were removed in 0.5.0: /payment/links is 404, no such route, and the official spec has none (verified 2026-10-28). Use "get_form" for a shareable hosted payment page, or paymentRequestData on document "create".`,
    {
      action: z.enum(["get_form", "search_tokens", "charge_token"])
        .describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      const id = data?.id as string | undefined;
      switch (action) {
        case "get_form":
          return json(await client.post("/payments/form", data));
        case "search_tokens":
          return json(await client.post("/payments/tokens/search", data));
        case "charge_token": {
          const body = { ...data };
          delete body.id;
          return json(await client.post(`/payments/tokens/${id}/charge`, body));
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 9. WEBHOOK ───────────────────────────────────────────────────────

  server.tool(
    "webhook",
    `Webhook reference and delivery verification. Webhooks are configured in the morning web app (Developer Tools > Webhooks, ${WEBHOOK_SETTINGS_URL}), not through the API: there are no webhook endpoints (/webhooks is 404, verified 2026-10-28). Deliveries are an HTTP POST with a JSON body and headers x-webhook-topic, x-webhook-id, x-webhook-delivery-id, x-webhook-timestamp, x-correlation-id, and x-webhook-signature when a secret is set. Acknowledge with 200/201/202/204; after 15 failed deliveries the webhook goes inactive.

Actions:
"list_events" = the event topics you can subscribe to
"verify_signature" = check a delivery's x-webhook-signature (HMAC-SHA256 of the RAW body, hex, keyed with the webhook secret). data: {"body":"<raw body exactly as received>", "signature":"<x-webhook-signature>", "secret":"<webhook secret>"}`,
    {
      action: z.enum(["list_events", "verify_signature"]).describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      switch (action) {
        case "list_events":
          return json({ configureAt: WEBHOOK_SETTINGS_URL, events: WEBHOOK_EVENTS });
        case "verify_signature": {
          const body = data?.body as string | undefined;
          const signature = data?.signature as string | undefined;
          const secret = data?.secret as string | undefined;
          if (body === undefined || !signature || !secret) {
            throw new Error("verify_signature needs data.body (raw), data.signature and data.secret");
          }
          const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
          const a = Buffer.from(expected);
          const b = Buffer.from(signature.trim().toLowerCase());
          return json({ valid: a.length === b.length && timingSafeEqual(a, b) });
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 10. REFERENCE DATA ───────────────────────────────────────────────

  server.tool(
    "reference_data",
    `Lookup reference data (no authentication required, served from cache.greeninvoice.co.il).

Actions:
"occupations" = get business categories/subcategories (data: {"locale":"he_IL"})
"countries" = get supported countries (data: {"locale":"he_IL"} or {"locale":"en_US"})
"cities" = get supported cities (data: {"locale":"he_IL", "country":"IL"})
"currencies" = get exchange rates (data: {"base":"ILS"})`,
    {
      action: z.enum(["occupations", "countries", "cities", "currencies"]).describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      const CACHE_BASE = "https://cache.greeninvoice.co.il";
      let url: string;
      switch (action) {
        case "occupations":
          url = `${CACHE_BASE}/businesses/v1/occupations?locale=${data?.locale || "he_IL"}`;
          break;
        case "countries":
          url = `${CACHE_BASE}/geo-location/v1/countries?locale=${data?.locale || "he_IL"}`;
          break;
        case "cities":
          url = `${CACHE_BASE}/geo-location/v1/cities?locale=${data?.locale || "he_IL"}&country=${data?.country || "IL"}`;
          break;
        case "currencies":
          url = `${CACHE_BASE}/currency-exchange/v1/latest?base=${data?.base || "ILS"}`;
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Reference data error (${res.status}): ${await res.text()}`);
      return json(await res.json());
    }
  );

  // ── 11. SANDBOX ──────────────────────────────────────────────────────

  server.tool(
    "sandbox",
    `Create and inspect TEST documents in the Green Invoice sandbox (${SANDBOX_BASE}). Use this instead of the 'document' tool whenever the goal is to try something out, demo a flow, or validate a payload shape — nothing here touches the real books.

This tool is hard-bound to the sandbox base URL and cannot reach production, no matter what is passed to it. The other ten tools remain on whichever environment the server was started against.

Requires its OWN credentials: the sandbox is a separate environment with separate accounts, and production API keys are rejected there with 401. Set GREENINVOICE_SANDBOX_API_ID and GREENINVOICE_SANDBOX_API_SECRET from a sandbox account created at https://app.sandbox.d.greeninvoice.co.il/. Run action "status" first to check.

${DOC_TYPES}. ${PAYMENT_TYPES}. ${CURRENCIES}.

Actions:
"status" = report whether sandbox credentials are configured, and if so verify them against the sandbox (GET /businesses/me). Safe, read-only, no arguments. Note /account/me answers 403 for API-key auth, so it is probed best-effort only and a failure there is reported as accountNote, not as a credential problem.
"create_test_document" = create a document from a minimal spec, filling in every required field. All arguments optional (data: {type (default 305), price (default 100), quantity (default 1), currency (default ILS), lang (default en), date (default today), dueDate, description, remarks, itemDescription, vatType, clientName (default "MCP Sandbox Test Client"), clientEmails:[], clientTaxId, addClient (default true — auto-creates the client), paymentType (default 4=Bank Transfer), paymentAmount}). Types 320/400/405 get a payment array automatically; its default is the line subtotal, which with vatType 0 leaves the document partially paid — pass paymentAmount to settle in full.
"seed" = create one test document of each of types ${SEED_TYPES.join(", ")} in a single call, for populating an empty sandbox (data: {price, currency, clientName} — all optional, applied to every document). Returns a per-type result list including any failures.
"create_document" = create a document from a full explicit payload, same shape as the 'document' tool's create action (data: {type, client:{...}, income:[...], payment:[...], ...}). No defaults are filled in.
"preview_document" = render a payload as a base64 PDF WITHOUT creating anything (data: same shape as create_document). The cheapest way to check a payload is well-formed.
"get_document" = get a sandbox document by ID (data: {"id":"..."})
"search_documents" = search sandbox documents (data: {page, pageSize, type:[], status:[], fromDate, toDate, sort})
"download_links" = get PDF download links for a sandbox document (data: {"id":"..."})
"create_test_client" = create a test client (data: {name, emails:[], taxId, phone, address, city, ...} — all optional, name defaults to a timestamped test name)
"search_clients" = search sandbox clients (data: {page, pageSize, name, email, active})
"request" = escape hatch for any other sandbox endpoint (data: {"method":"POST","path":"/items/search","body":{...}}). Reaches all 66 endpoints without duplicating the whole tool surface.

Note: there is deliberately no "send" action — sandbox document emails would still be delivered to real inboxes. Use "download_links" or "preview_document" to inspect output instead.`,
    {
      action: z.enum(["status", "create_test_document", "seed", "create_document", "preview_document", "get_document", "search_documents", "download_links", "create_test_client", "search_clients", "request"])
        .describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters (see action descriptions)"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;

      if (!sandboxClient) {
        const message =
          "Sandbox is not configured. The Green Invoice sandbox is a separate environment " +
          "with its own accounts — production API keys are rejected there with HTTP 401 " +
          "(verified 2026-07-25). To enable this tool:\n" +
          "  1. Create a sandbox account at https://app.sandbox.d.greeninvoice.co.il/\n" +
          "  2. In that account, generate an API key (My Account > Developer Tools > API Keys)\n" +
          "  3. Set GREENINVOICE_SANDBOX_API_ID and GREENINVOICE_SANDBOX_API_SECRET on this MCP server\n" +
          "Alternatively, set GREENINVOICE_SANDBOX=true to point the entire server (all tools) " +
          "at the sandbox using GREENINVOICE_API_ID/SECRET.";
        if (action === "status") {
          return json({ configured: false, baseUrl: SANDBOX_BASE, message });
        }
        throw new Error(message);
      }

      const sb = sandboxClient;
      const id = data?.id as string | undefined;

      switch (action) {
        case "status": {
          const result: Record<string, unknown> = {
            configured: true,
            baseUrl: sb.base,
            sharedWithMainClient: sb === client,
          };
          // /businesses/me is the liveness probe: it is the endpoint an API key
          // is always scoped for.
          try {
            result.business = await sb.get("/businesses/me");
            result.reachable = true;
          } catch (err) {
            result.reachable = false;
            result.error = err instanceof Error ? err.message : String(err);
          }
          // /account/me is best-effort only — it answers 403 for API-key auth on
          // at least some plans (verified against production 2026-07-25), so a
          // failure here says nothing about whether credentials are good.
          try {
            result.account = await sb.get("/account/me");
          } catch (err) {
            result.accountNote = `GET /account/me unavailable (${
              err instanceof Error ? err.message : String(err)
            }) — not a credential problem; this endpoint is commonly forbidden for API keys.`;
          }
          return json(result);
        }

        case "create_test_document": {
          const body = buildTestDocument(data ?? {});
          return json({ sent: body, response: await sb.post("/documents", body) });
        }

        case "seed": {
          const results: Array<Record<string, unknown>> = [];
          for (const type of SEED_TYPES) {
            const body = buildTestDocument({ ...data, type });
            try {
              results.push({ type, ok: true, response: await sb.post("/documents", body) });
            } catch (err) {
              results.push({
                type,
                ok: false,
                error: err instanceof Error ? err.message : String(err),
                sent: body,
              });
            }
          }
          return json({ baseUrl: sb.base, created: results.filter((r) => r.ok).length, results });
        }

        case "create_document": {
          const body = { ...data };
          delete body.id;
          return json(await sb.post("/documents", body));
        }

        case "preview_document": {
          const body = { ...data };
          delete body.id;
          return json(await sb.post("/documents/preview", body));
        }

        case "get_document":
          return json(await sb.get(`/documents/${id}`));

        case "search_documents":
          return json(await sb.post("/documents/search", data ?? {}));

        case "download_links":
          return json(await sb.get(`/documents/${id}/download/links`));

        case "create_test_client": {
          const body = {
            name: `MCP Sandbox Test Client ${today()}`,
            active: true,
            remarks: TEST_REMARKS,
            ...data,
          };
          delete (body as Record<string, unknown>).id;
          return json(await sb.post("/clients", body));
        }

        case "search_clients":
          return json(await sb.post("/clients/search", data ?? {}));

        case "request": {
          const method = String(data?.method ?? "GET").toUpperCase();
          const path = data?.path as string | undefined;
          if (!path) throw new Error("'path' is required for the request action, e.g. \"/items/search\"");
          if (!path.startsWith("/")) throw new Error(`'path' must start with '/': ${path}`);
          return json(await sb.request(method, path, data?.body));
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );
}
