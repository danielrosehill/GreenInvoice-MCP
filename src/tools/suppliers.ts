import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "../client.js";
import { PageShape, json, toolError } from "./schemas.js";

export function register(server: McpServer, client: GreenInvoiceClient): void {

  server.tool(
    "supplier-search",
    "Search suppliers by name, email, or other criteria. Suppliers are used for expense tracking. (POST /suppliers/search)",
    {
      ...PageShape,
      name: z.string().optional().describe("Filter by supplier name (partial match)"),
      email: z.string().optional().describe("Filter by email address"),
      active: z.boolean().optional().describe("Filter by active status"),
      contactPerson: z.string().optional().describe("Filter by contact person name"),
      labels: z.array(z.string()).optional().describe("Filter by label IDs"),
    },
    async (params) => {
      try {
        return json(await client.post("/suppliers/search", params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "supplier-get",
    "Get a single supplier record by ID. (GET /suppliers/:id)",
    {
      id: z.string().describe("Supplier ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/suppliers/${id}`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "supplier-manage",
    `Create or modify supplier records. Actions:
- "create": create a new supplier
- "update": update an existing supplier's fields
- "delete": delete a supplier (NOTE: only inactive suppliers can be deleted)
- "merge": merge two suppliers — one must be inactive; the inactive one is deleted`,
    {
      action: z.enum(["create", "update", "delete", "merge"])
        .describe("Action to perform"),
      id: z.string().optional().describe("Supplier ID. Required for: update, delete, merge"),
      // create / update fields
      name: z.string().optional().describe("Supplier name. Required for create"),
      emails: z.array(z.string()).optional().describe("Email addresses"),
      taxId: z.string().optional().describe("Tax/business ID number"),
      phone: z.string().optional(),
      mobile: z.string().optional(),
      fax: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      zip: z.string().optional().describe("Postal code"),
      country: z.string().optional().describe("Country code (e.g. IL)"),
      department: z.string().optional(),
      accountingKey: z.string().optional(),
      paymentTerms: z.number().int().optional().describe("Payment terms in days"),
      bankName: z.string().optional(),
      bankBranch: z.string().optional(),
      bankAccount: z.string().optional(),
      active: z.boolean().optional().describe("Whether the supplier is active"),
      contactPerson: z.string().optional(),
      remarks: z.string().optional(),
      labels: z.array(z.string()).optional().describe("Label IDs to assign"),
      // merge action
      mergeId: z.string().optional().describe("ID of the inactive supplier to merge into this one (merge action)"),
    },
    async ({ action, id, mergeId, ...fields }) => {
      try {
        switch (action) {
          case "create":
            return json(await client.post("/suppliers", fields));
          case "update":
            return json(await client.put(`/suppliers/${id}`, fields));
          case "delete":
            return json(await client.delete(`/suppliers/${id}`));
          case "merge":
            return json(await client.post(`/suppliers/${id}/merge`, { mergeId }));
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
