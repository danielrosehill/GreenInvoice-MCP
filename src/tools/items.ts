import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "../client.js";
import { CurrencyEnum, PageShape, json, toolError } from "./schemas.js";

export function register(server: McpServer, client: GreenInvoiceClient): void {

  server.tool(
    "item-search",
    "Search the product/service catalog by name, description, or currency. (POST /items/search)",
    {
      ...PageShape,
      name: z.string().optional().describe("Filter by item name (partial match)"),
      description: z.string().optional().describe("Filter by item description"),
      currency: CurrencyEnum.optional().describe("Filter by item currency"),
      active: z.boolean().optional().describe("Filter by active status"),
    },
    async (params) => {
      try {
        return json(await client.post("/items/search", params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "item-manage",
    `Manage catalog items (products or services). Actions:
- "get": get item details by ID
- "create": create a new catalog item
- "update": update an existing item
- "delete": delete an item`,
    {
      action: z.enum(["get", "create", "update", "delete"]).describe("Action to perform"),
      id: z.string().optional().describe("Item ID. Required for: get, update, delete"),
      name: z.string().optional().describe("Item name. Required for create"),
      description: z.string().optional().describe("Item description"),
      price: z.number().optional().describe("Default unit price. Required for create"),
      currency: CurrencyEnum.optional().describe("Item currency"),
      vatType: z.number().int().optional().describe(
        "VAT type: 0=default rate, 1=price includes VAT, 2=VAT exempt"
      ),
      sku: z.string().optional().describe("Stock-keeping unit / catalog number"),
      active: z.boolean().optional().describe("Whether the item is active (default: true)"),
    },
    async ({ action, id, ...fields }) => {
      try {
        switch (action) {
          case "get":
            return json(await client.get(`/items/${id}`));
          case "create":
            return json(await client.post("/items", fields));
          case "update":
            return json(await client.put(`/items/${id}`, fields));
          case "delete":
            return json(await client.delete(`/items/${id}`));
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
