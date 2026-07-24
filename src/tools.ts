/**
 * MCP tool definitions for the Green Invoice API.
 * Consolidated resource-based tools covering all 66 API endpoints.
 *
 * DISCLAIMER: This is an unofficial, third-party integration.
 * Not affiliated with or endorsed by Green Invoice.
 *
 * API Reference: https://www.greeninvoice.co.il/api-docs/
 * Apiary spec last updated: 2026-03-11
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "./client.js";

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

const CURRENCIES = `Currencies: ILS, USD, EUR, GBP, JPY, CHF, CNY, AUD, CAD, and more (28 supported)`;

// ════════════════════════════════════════════════════════════════════════

export function registerTools(server: McpServer, client: GreenInvoiceClient) {

  // ── 1. ACCOUNT ───────────────────────────────────────────────────────

  server.tool(
    "account",
    `Get account information.
Actions: "get" = account info (GET /account/me), "settings" = account settings (GET /account/settings).`,
    {
      action: z.enum(["get", "settings"]).describe("Action to perform"),
    },
    async ({ action }) => {
      const path = action === "settings" ? "/account/settings" : "/account/me";
      return json(await client.get(path));
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
"update" = update document (data: {"id":"...", ...fields})
"close" = close document (data: {"id":"..."})
"open" = reopen document (data: {"id":"..."})
"send" = send via email (data: {"id":"...", "email":"optional-override"})
"download_links" = get PDF download links (data: {"id":"..."})
"add_payment" = add payment to document (data: {"id":"...", type, price, currency, date, bankName, bankBranch, bankAccount, chequeNum})
"preview" = preview as base64 PDF (data: same shape as create)
"get_linked" = get linked documents (data: {"id":"..."})
"get_info" = get document info for a type (data: {"type":305})
"get_types" = list document types (data: {"lang":"he"} optional)
"get_statuses" = list document statuses (data: {"lang":"he"} optional)
"search_payments" = search payments within documents (data: {page, pageSize, type:[], paymentTypes:[], fromDate, toDate, paymentId, sort})`,
    {
      action: z.enum(["search", "get", "create", "update", "close", "open", "send", "download_links", "add_payment", "preview", "get_linked", "get_info", "get_types", "get_statuses", "search_payments"])
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
        case "send": {
          const body: Record<string, unknown> = {};
          if (data?.email) body.email = data.email;
          return json(await client.post(`/documents/${id}/send`, body));
        }
        case "download_links":
          return json(await client.get(`/documents/${id}/download/links`));
        case "add_payment": {
          const body = { ...data };
          delete body.id;
          return json(await client.post(`/documents/${id}/payment`, body));
        }
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
"search_drafts" = search expense drafts (data: {page, pageSize, fromDate, toDate, description, supplierId, supplierName})`,
    {
      action: z.enum(["search", "get", "create", "update", "delete", "open", "close", "get_statuses", "get_classifications", "search_drafts"])
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
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 8. PAYMENT ───────────────────────────────────────────────────────

  server.tool(
    "payment",
    `Manage payments and payment links. ${PAYMENT_TYPES}.

Actions:
"get_form" = get payment form URL for online payment (data: {type, description, lang, currency, vatType, amount, maxPayments, pluginId, group, client:{...}, income:[...], remarks, successUrl, failureUrl, notifyUrl, custom})
"search_tokens" = search saved credit card tokens (data: {paymentNumber, cardHolder, externalKey})
"charge_token" = charge a saved credit card token (data: {"id":"tokenId", type, description, lang, currency, vatType, amount, maxPayments, income:[...], remarks, notifyUrl})
"create_link" = create payment link (data: {client:{...}, income:[...], currency, lang, remarks})
"get_link" = get payment link details (data: {"id":"..."})
"get_link_status" = check payment link status (data: {"id":"..."})`,
    {
      action: z.enum(["get_form", "search_tokens", "charge_token", "create_link", "get_link", "get_link_status"])
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
        case "create_link":
          return json(await client.post("/payment/links", data));
        case "get_link":
          return json(await client.get(`/payment/links/${id}`));
        case "get_link_status":
          return json(await client.get(`/payment/links/${id}/status`));
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  );

  // ── 9. WEBHOOK ───────────────────────────────────────────────────────

  server.tool(
    "webhook",
    `Manage webhook subscriptions. Available events: document.created, document.updated, document.sent, document.paid, document.overdue, payment.received, payment.failed, payment.refunded, client.created, client.updated, client.deleted.

Actions:
"create" = create webhook (data: {"url":"https://...", "events":["document.created",...]})
"get" = get webhook by ID (data: {"id":"..."})
"delete" = delete webhook (data: {"id":"..."})`,
    {
      action: z.enum(["create", "get", "delete"]).describe("Action to perform"),
      data: z.string().optional().describe("JSON string of request parameters"),
    },
    async ({ action, data: raw }) => {
      const data = parseData(raw) as Record<string, unknown> | undefined;
      const id = data?.id as string | undefined;
      switch (action) {
        case "create":
          return json(await client.post("/webhooks", data));
        case "get":
          return json(await client.get(`/webhooks/${id}`));
        case "delete":
          return json(await client.delete(`/webhooks/${id}`));
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
}
