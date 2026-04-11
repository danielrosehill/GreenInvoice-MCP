import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "../client.js";
import {
  CurrencyEnum, LangEnum, PaymentTypeSchema,
  DocumentBodyShape, PaymentItemSchema,
  PageShape, json, toolError,
} from "./schemas.js";

export function register(server: McpServer, client: GreenInvoiceClient): void {

  // ── Search ──────────────────────────────────────────────────────────────

  server.tool(
    "document-search",
    "Search documents (invoices, receipts, quotes, etc.) by various criteria. (POST /documents/search)",
    {
      ...PageShape,
      type: z.array(z.number().int()).optional().describe(
        "Filter by document type codes: 10=Quote, 305=Tax Invoice, 320=Tax Invoice+Receipt, 330=Credit, 400=Receipt"
      ),
      status: z.array(z.number().int()).optional().describe(
        "Filter by status codes: 0=Open, 1=Closed, 2=Manually Closed, 3=Canceling, 4=Canceled"
      ),
      fromDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
      toDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
      clientId: z.string().optional().describe("Filter by client ID"),
      clientName: z.string().optional().describe("Filter by client name (partial match)"),
      description: z.string().optional().describe("Filter by document description"),
      number: z.string().optional().describe("Filter by document number"),
      paymentTypes: z.array(z.number().int()).optional().describe(
        "Filter by payment types: 1=Cash, 2=Check, 3=Credit Card, 4=Bank Transfer, 5=PayPal"
      ),
      sort: z.string().optional().describe("Sort field"),
      download: z.boolean().optional().describe("Include download links in results"),
    },
    async (params) => {
      try {
        return json(await client.post("/documents/search", params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-search-payments",
    "Search payment transactions recorded within documents. (POST /documents/payments/search)",
    {
      ...PageShape,
      type: z.array(z.number().int()).optional().describe("Filter by document type codes"),
      paymentTypes: z.array(z.number().int()).optional().describe("Filter by payment types"),
      fromDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
      toDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
      paymentId: z.string().optional().describe("Filter by specific payment ID"),
      sort: z.string().optional(),
    },
    async (params) => {
      try {
        return json(await client.post("/documents/payments/search", params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // ── Read ────────────────────────────────────────────────────────────────

  server.tool(
    "document-get",
    "Get document details by ID. Returns the full document including client, line items, payment info, and status. (GET /documents/:id)",
    {
      id: z.string().describe("Document ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/documents/${id}`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-get-linked",
    "Get documents linked to a given document (e.g. credit note linked to an invoice). (GET /documents/:id/linked)",
    {
      id: z.string().describe("Document ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/documents/${id}/linked`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-get-download-links",
    "Get PDF download URLs for a document (Hebrew, English, and original language versions). (GET /documents/:id/download/links)",
    {
      id: z.string().describe("Document ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/documents/${id}/download/links`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-get-reference",
    `Retrieve reference metadata for documents. Actions:
- "types": list all supported document types with their names
- "statuses": list all document status codes with their names
- "info": get field requirements and defaults for a specific document type`,
    {
      action: z.enum(["types", "statuses", "info"]).describe("Reference data to retrieve"),
      type: z.number().int().optional().describe("Document type code (info action only)"),
      lang: LangEnum.optional().describe("Language for labels (types and statuses actions)"),
    },
    async ({ action, type, lang }) => {
      try {
        switch (action) {
          case "types": {
            const query = lang ? `?lang=${lang}` : "";
            return json(await client.get(`/documents/types${query}`));
          }
          case "statuses": {
            const query = lang ? `?lang=${lang}` : "";
            return json(await client.get(`/documents/statuses${query}`));
          }
          case "info":
            return json(await client.get(`/documents/info?type=${type}`));
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // ── Create / Preview ────────────────────────────────────────────────────

  server.tool(
    "document-create",
    `Create a new document (invoice, receipt, quote, etc.).

IMPORTANT field names:
- Use 'income' for line items (NOT 'items')
- Use 'payment' for payment details (NOT 'payments')
- Use 'remarks' for internal notes (NOT 'notes')
- Use 'lang' for language (NOT 'language')
- 'emails' must be an array even for a single address

Types 320 (Tax Invoice+Receipt), 400 (Receipt), and 405 (Donation Receipt) REQUIRE a 'payment' array.
Payment dates cannot be in the future for receipt types.
Set client.add=true to auto-create a new client on the fly.

(POST /documents)`,
    DocumentBodyShape,
    async (body) => {
      try {
        return json(await client.post("/documents", body));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-preview",
    `Preview a document as a base64-encoded PDF without saving it. Accepts the same fields as document-create.
Useful for showing the client a draft before committing.

(POST /documents/preview)`,
    DocumentBodyShape,
    async (body) => {
      try {
        return json(await client.post("/documents/preview", body));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // ── Update / Lifecycle ──────────────────────────────────────────────────

  server.tool(
    "document-update",
    "Update fields on an existing draft document. Cannot update a closed document. (PUT /documents/:id)",
    {
      id: z.string().describe("Document ID to update"),
      ...DocumentBodyShape,
      type: DocumentBodyShape.type.optional(),
    },
    async ({ id, ...body }) => {
      try {
        return json(await client.put(`/documents/${id}`, body));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-close",
    "Close (finalize) an open document. Once closed, a document cannot be edited. (POST /documents/:id/close)",
    {
      id: z.string().describe("Document ID to close"),
    },
    async ({ id }) => {
      try {
        return json(await client.post(`/documents/${id}/close`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-open",
    "Reopen a manually-closed document, allowing it to be edited again. (POST /documents/:id/open)",
    {
      id: z.string().describe("Document ID to reopen"),
    },
    async ({ id }) => {
      try {
        return json(await client.post(`/documents/${id}/open`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-send",
    "Send a document to the client via email. Uses the client's email on file, or an override address. (POST /documents/:id/send)",
    {
      id: z.string().describe("Document ID to send"),
      email: z.string().email().optional().describe("Override recipient email address (uses client's email if omitted)"),
    },
    async ({ id, email }) => {
      try {
        const body: Record<string, unknown> = {};
        if (email) body.email = email;
        return json(await client.post(`/documents/${id}/send`, body));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document-add-payment",
    "Record a payment received against an existing document (e.g. mark a tax invoice as paid). (POST /documents/:id/payment)",
    {
      id: z.string().describe("Document ID to add payment to"),
      ...PaymentItemSchema.shape,
      currency: CurrencyEnum.optional().describe("Payment currency"),
    },
    async ({ id, ...paymentData }) => {
      try {
        return json(await client.post(`/documents/${id}/payment`, paymentData));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
