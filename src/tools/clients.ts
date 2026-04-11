import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "../client.js";
import { PageShape, json, toolError } from "./schemas.js";

export function register(server: McpServer, client: GreenInvoiceClient): void {

  server.tool(
    "client-search",
    "Search clients by name, email, tax ID, or other criteria. (POST /clients/search)",
    {
      ...PageShape,
      name: z.string().optional().describe("Filter by client name (partial match)"),
      email: z.string().optional().describe("Filter by email address"),
      taxId: z.string().optional().describe("Filter by tax/business ID"),
      active: z.boolean().optional().describe("Filter by active status"),
      contactPerson: z.string().optional().describe("Filter by contact person name"),
      labels: z.array(z.string()).optional().describe("Filter by label IDs"),
      sort: z.string().optional().describe("Sort field"),
      sortType: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    },
    async (params) => {
      try {
        return json(await client.post("/clients/search", params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "client-get",
    "Get a single client record by ID. (GET /clients/:id)",
    {
      id: z.string().describe("Client ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/clients/${id}`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "client-manage",
    `Create or modify client records. Actions:
- "create": create a new client
- "update": update an existing client's fields
- "delete": delete a client (NOTE: only inactive clients can be deleted)
- "merge": merge two clients — one must be inactive; the inactive one is deleted (data: id + mergeId)
- "associate-docs": link existing documents to a client
- "update-balance": manually set or reset a client's outstanding balance`,
    {
      action: z.enum(["create", "update", "delete", "merge", "associate-docs", "update-balance"])
        .describe("Action to perform"),
      id: z.string().optional().describe(
        "Client ID. Required for: update, delete, merge, associate-docs, update-balance"
      ),
      // create / update fields
      name: z.string().optional().describe("Client display name. Required for create"),
      emails: z.array(z.string()).optional().describe("Email addresses (use array, not a single email string)"),
      taxId: z.string().optional().describe("Tax/business ID number"),
      phone: z.string().optional(),
      mobile: z.string().optional(),
      fax: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      zip: z.string().optional().describe("Postal code"),
      country: z.string().optional().describe("Country code (e.g. IL, US)"),
      category: z.string().optional(),
      subCategory: z.string().optional(),
      accountingKey: z.string().optional(),
      paymentTerms: z.number().int().optional().describe("Payment terms in days"),
      bankName: z.string().optional(),
      bankBranch: z.string().optional(),
      bankAccount: z.string().optional(),
      active: z.boolean().optional().describe("Whether the client is active"),
      department: z.string().optional(),
      contactPerson: z.string().optional(),
      remarks: z.string().optional(),
      labels: z.array(z.string()).optional().describe("Label IDs to assign"),
      // merge action
      mergeId: z.string().optional().describe("ID of the inactive client to merge into this one (merge action)"),
      // associate-docs action
      documentIds: z.array(z.string()).optional().describe("Document IDs to associate with this client (associate-docs action)"),
      // update-balance action
      balance: z.number().optional().describe("New balance amount (update-balance action)"),
    },
    async ({ action, id, mergeId, documentIds, balance, ...fields }) => {
      try {
        switch (action) {
          case "create":
            return json(await client.post("/clients", fields));
          case "update":
            return json(await client.put(`/clients/${id}`, fields));
          case "delete":
            return json(await client.delete(`/clients/${id}`));
          case "merge":
            return json(await client.post(`/clients/${id}/merge`, { mergeId }));
          case "associate-docs":
            return json(await client.post(`/clients/${id}/assoc`, { ids: documentIds }));
          case "update-balance":
            return json(await client.post(`/clients/${id}/balance`, { balance }));
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
