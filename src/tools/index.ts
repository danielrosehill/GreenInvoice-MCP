import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GreenInvoiceClient } from "../client.js";
import { register as registerAccount } from "./account.js";
import { register as registerBusiness } from "./business.js";
import { register as registerDocuments } from "./documents.js";
import { register as registerClients } from "./clients.js";
import { register as registerSuppliers } from "./suppliers.js";
import { register as registerItems } from "./items.js";
import { register as registerExpenses } from "./expenses.js";
import { register as registerPayments } from "./payments.js";
import { register as registerWebhooks } from "./webhooks.js";
import { register as registerReference } from "./reference.js";

export function registerTools(server: McpServer, client: GreenInvoiceClient): void {
  registerAccount(server, client);
  registerBusiness(server, client);
  registerDocuments(server, client);
  registerClients(server, client);
  registerSuppliers(server, client);
  registerItems(server, client);
  registerExpenses(server, client);
  registerPayments(server, client);
  registerWebhooks(server, client);
  registerReference(server);
}
