/**
 * Shared Zod schemas and helper utilities for Green Invoice MCP tools.
 */

import { z } from "zod";

// ── Enums ─────────────────────────────────────────────────────────────────

export const CurrencyEnum = z.enum([
  "ILS", "USD", "EUR", "GBP", "JPY", "CHF", "CNY", "AUD", "CAD",
  "DKK", "NOK", "ZAR", "SEK", "CZK", "IMP", "JOD", "LBP", "EGP",
  "HRK", "HUF", "INR", "RUB", "TRY", "UAH", "BRL", "PLN", "RON", "MXN",
]);

export const LangEnum = z.enum(["he", "en"]).describe("Language: he=Hebrew, en=English");

export const DocumentTypeSchema = z.number().int().describe(
  "Document type code: 10=Price Quote, 100=Order, 200=Delivery Note, 210=Return Delivery Note, " +
  "300=Transaction Account, 305=Tax Invoice, 320=Tax Invoice+Receipt (requires payment array), " +
  "330=Credit Invoice/Refund, 400=Receipt (requires payment array), 405=Donation Receipt (requires payment array)"
);

export const PaymentTypeSchema = z.number().int().describe(
  "Payment type: -1=Unpaid, 0=Deduction at Source, 1=Cash, 2=Check, 3=Credit Card, " +
  "4=Bank Transfer, 5=PayPal, 10=Payment App, 11=Other"
);

// ── Pagination ────────────────────────────────────────────────────────────

export const PageShape = {
  page: z.number().int().positive().optional().describe("Page number (1-based)"),
  pageSize: z.number().int().positive().optional().describe("Results per page"),
};

// ── Sub-schemas for document creation ─────────────────────────────────────

export const IncomeItemSchema = z.object({
  catalogNum: z.string().optional().describe("Catalog/SKU number"),
  description: z.string().describe("Line item description"),
  quantity: z.number().positive().optional().describe("Quantity (default: 1)"),
  price: z.number().describe("Unit price"),
  currency: CurrencyEnum.optional().describe("Item currency (defaults to document currency)"),
  vatType: z.number().int().optional().describe("VAT type: 0=default rate, 1=price includes VAT, 2=VAT exempt"),
  itemId: z.string().optional().describe("Reference to an existing catalog item ID"),
});

export const PaymentItemSchema = z.object({
  date: z.string().describe("Payment date (YYYY-MM-DD). Cannot be future-dated for receipt types (320, 400, 405)"),
  type: PaymentTypeSchema,
  price: z.number().positive().describe("Payment amount"),
  currency: CurrencyEnum.optional().describe("Payment currency"),
  bankName: z.string().optional().describe("Bank name (for check or bank transfer)"),
  bankBranch: z.string().optional().describe("Bank branch number"),
  bankAccount: z.string().optional().describe("Bank account number"),
  chequeNum: z.string().optional().describe("Cheque number"),
});

export const ClientSubSchema = z.object({
  id: z.string().optional().describe("Existing client ID"),
  name: z.string().optional().describe("Client name"),
  emails: z.array(z.string()).optional().describe("Email addresses. Use 'emails' array, not 'email'"),
  taxId: z.string().optional().describe("Tax/business ID number"),
  address: z.string().optional().describe("Street address"),
  city: z.string().optional(),
  zip: z.string().optional().describe("Postal code"),
  country: z.string().optional().describe("Country code (e.g. IL, US)"),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  add: z.boolean().optional().describe("Set true to auto-create client if not found by ID"),
  self: z.boolean().optional().describe("Set true if the document is issued to yourself"),
});

// ── Document body shape (used by create and preview) ──────────────────────

export const DocumentBodyShape = {
  type: DocumentTypeSchema,
  client: ClientSubSchema.optional().describe("Client details. Required for most document types"),
  income: z.array(IncomeItemSchema).optional().describe(
    "Line items. Use 'income' key (not 'items'). Required for tax invoice types"
  ),
  payment: z.array(PaymentItemSchema).optional().describe(
    "Payment details. REQUIRED for types 320 (Tax Invoice+Receipt), 400 (Receipt), 405 (Donation Receipt). Payment dates cannot be in the future"
  ),
  currency: CurrencyEnum.optional().describe("Document currency (default: ILS)"),
  lang: LangEnum.optional().describe("Document language"),
  description: z.string().optional().describe("Document title/description"),
  remarks: z.string().optional().describe("Internal remarks. Use 'remarks' key (not 'notes')"),
  footer: z.string().optional().describe("Custom footer text for this document"),
  emailContent: z.string().optional().describe("Custom email body when sending the document"),
  signed: z.boolean().optional().describe("Include digital signature"),
  rounding: z.boolean().optional().describe("Round totals"),
  date: z.string().optional().describe("Document date (YYYY-MM-DD, defaults to today)"),
  dueDate: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
  discount: z.object({
    amount: z.number().describe("Discount value"),
    type: z.number().int().describe("Discount type: 0=fixed amount, 1=percentage"),
  }).optional(),
  maxPayments: z.number().int().positive().optional().describe("Maximum installments for credit card payment"),
  linkedDocumentIds: z.array(z.string()).optional().describe("IDs of documents to link to this one"),
  linkedPaymentId: z.string().optional().describe("ID of payment to link to this document"),
  attachment: z.string().optional().describe("Base64-encoded file attachment"),
};

// ── Response helpers ───────────────────────────────────────────────────────

type ToolContent = { type: "text"; text: string };
type ToolResult = { content: ToolContent[]; isError?: true };

export function json(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function toolError(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}
