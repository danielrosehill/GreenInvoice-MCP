import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "../client.js";
import { json, toolError } from "./schemas.js";

const WEBHOOK_EVENTS = [
  "document.created", "document.updated", "document.sent", "document.paid", "document.overdue",
  "payment.received", "payment.failed", "payment.refunded",
  "client.created", "client.updated", "client.deleted",
] as const;

export function register(server: McpServer, client: GreenInvoiceClient): void {

  server.tool(
    "webhook-create",
    `Create a webhook subscription. The endpoint will receive POST requests when the specified events occur.

Available events: document.created, document.updated, document.sent, document.paid, document.overdue, payment.received, payment.failed, payment.refunded, client.created, client.updated, client.deleted

(POST /webhooks)`,
    {
      url: z.string().url().describe("HTTPS URL that will receive webhook POST requests"),
      events: z.array(z.enum(WEBHOOK_EVENTS)).describe("List of event types to subscribe to"),
    },
    async ({ url, events }) => {
      try {
        return json(await client.post("/webhooks", { url, events }));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "webhook-get",
    "Get details of an existing webhook subscription by ID. (GET /webhooks/:id)",
    {
      id: z.string().describe("Webhook ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/webhooks/${id}`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "webhook-delete",
    "Delete a webhook subscription. (DELETE /webhooks/:id)",
    {
      id: z.string().describe("Webhook ID to delete"),
    },
    async ({ id }) => {
      try {
        return json(await client.delete(`/webhooks/${id}`));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
