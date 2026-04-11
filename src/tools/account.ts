import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GreenInvoiceClient } from "../client.js";
import { json, toolError } from "./schemas.js";

export function register(server: McpServer, client: GreenInvoiceClient): void {
  server.tool(
    "account-get",
    "Get authenticated account information including name, email, and plan details. (GET /account/me)",
    {},
    async () => {
      try {
        return json(await client.get("/account/me"));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "account-get-settings",
    "Get account-level settings and configuration. (GET /account/settings)",
    {},
    async () => {
      try {
        return json(await client.get("/account/settings"));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
