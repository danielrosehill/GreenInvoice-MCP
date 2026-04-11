import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "../client.js";
import { CurrencyEnum, PaymentTypeSchema, PageShape, json, toolError } from "./schemas.js";

export function register(server: McpServer, client: GreenInvoiceClient): void {

  server.tool(
    "expense-search",
    `Search expenses or expense drafts. Actions:
- "expenses": search reported/open expenses
- "drafts": search expense drafts (created from uploaded files)
(POST /expenses/search, POST /expenses/drafts/search)`,
    {
      action: z.enum(["expenses", "drafts"]).default("expenses").describe(
        "What to search: 'expenses' (default) or 'drafts'"
      ),
      ...PageShape,
      fromDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
      toDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
      description: z.string().optional().describe("Filter by expense description"),
      supplierId: z.string().optional().describe("Filter by supplier ID"),
      supplierName: z.string().optional().describe("Filter by supplier name"),
      number: z.string().optional().describe("Filter by expense document number"),
      paid: z.boolean().optional().describe("Filter by paid status (expenses only)"),
      reported: z.boolean().optional().describe("Filter by reported status (expenses only)"),
      minAmount: z.number().optional().describe("Minimum amount filter (expenses only)"),
      maxAmount: z.number().optional().describe("Maximum amount filter (expenses only)"),
      accountingClassificationId: z.string().optional().describe("Filter by accounting classification ID"),
      sort: z.string().optional(),
    },
    async ({ action, ...params }) => {
      try {
        const path = action === "drafts" ? "/expenses/drafts/search" : "/expenses/search";
        return json(await client.post(path, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "expense-get",
    "Get a single expense record by ID. (GET /expenses/:id)",
    {
      id: z.string().describe("Expense ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/expenses/${id}`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "expense-get-reference",
    `Retrieve reference data for expenses. Actions:
- "statuses": list expense status codes (10=Open, 20=Reported)
- "classifications": get the accounting classifications map for categorizing expenses`,
    {
      action: z.enum(["statuses", "classifications"]).describe("Reference data to retrieve"),
    },
    async ({ action }) => {
      try {
        switch (action) {
          case "statuses":
            return json(await client.get("/expenses/statuses"));
          case "classifications":
            return json(await client.get("/accounting/classifications/map"));
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "expense-manage",
    `Create or modify expense records. Actions:
- "create": create a new expense
- "update": update an expense (NOTE: cannot update once reported, status=20)
- "delete": delete an expense
- "open": reopen a closed expense
- "close": close/report an expense (marks it as reported; irreversible)

Expense document types: 10=Invoice, 20=Receipt, 30=Invoice+Receipt, 40=Other`,
    {
      action: z.enum(["create", "update", "delete", "open", "close"])
        .describe("Action to perform"),
      id: z.string().optional().describe("Expense ID. Required for: update, delete, open, close"),
      // create / update fields
      paymentType: PaymentTypeSchema.optional().describe("Payment type used for this expense"),
      currency: CurrencyEnum.optional().describe("Expense currency"),
      currencyRate: z.number().optional().describe("Exchange rate to ILS (if currency != ILS)"),
      vat: z.number().optional().describe("VAT amount"),
      amount: z.number().optional().describe("Total expense amount. Required for create"),
      date: z.string().optional().describe("Expense date (YYYY-MM-DD). Required for create"),
      dueDate: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
      reportingDate: z.string().optional().describe("Accounting reporting date (YYYY-MM-DD)"),
      documentType: z.number().int().optional().describe(
        "Expense document type: 10=Invoice, 20=Receipt, 30=Invoice+Receipt, 40=Other"
      ),
      number: z.string().optional().describe("Supplier's document number"),
      description: z.string().optional().describe("Expense description"),
      remarks: z.string().optional(),
      supplier: z.object({
        id: z.string().optional().describe("Existing supplier ID"),
        name: z.string().optional().describe("Supplier name"),
        taxId: z.string().optional(),
      }).optional().describe("Supplier details"),
      accountingClassification: z.object({
        id: z.string().optional(),
        key: z.string().optional(),
        code: z.string().optional(),
        title: z.string().optional(),
      }).optional().describe("Accounting classification for this expense"),
      active: z.boolean().optional(),
    },
    async ({ action, id, ...fields }) => {
      try {
        switch (action) {
          case "create":
            return json(await client.post("/expenses", fields));
          case "update":
            return json(await client.put(`/expenses/${id}`, fields));
          case "delete":
            return json(await client.delete(`/expenses/${id}`));
          case "open":
            return json(await client.post(`/expenses/${id}/open`));
          case "close":
            return json(await client.post(`/expenses/${id}/close`));
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
