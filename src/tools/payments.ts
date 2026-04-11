import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "../client.js";
import { CurrencyEnum, LangEnum, IncomeItemSchema, ClientSubSchema, json, toolError } from "./schemas.js";

export function register(server: McpServer, client: GreenInvoiceClient): void {

  server.tool(
    "payment-get-form",
    "Generate a hosted payment form URL for collecting online payments from clients. Returns a URL to embed or share. (POST /payments/form)",
    {
      type: z.number().int().optional().describe("Document type to generate on successful payment"),
      description: z.string().optional().describe("Payment description shown to the payer"),
      lang: LangEnum.optional().describe("Payment page language"),
      currency: CurrencyEnum.optional().describe("Payment currency"),
      vatType: z.number().int().optional().describe("VAT type: 0=default, 1=included, 2=exempt"),
      amount: z.number().positive().optional().describe("Fixed payment amount (if not using income items)"),
      maxPayments: z.number().int().positive().optional().describe("Maximum installments"),
      pluginId: z.string().optional().describe("Payment plugin/gateway ID"),
      group: z.string().optional(),
      client: ClientSubSchema.optional().describe("Pre-fill client details on the payment form"),
      income: z.array(IncomeItemSchema).optional().describe("Line items to include in the payment"),
      remarks: z.string().optional(),
      successUrl: z.string().url().optional().describe("Redirect URL after successful payment"),
      failureUrl: z.string().url().optional().describe("Redirect URL after failed payment"),
      notifyUrl: z.string().url().optional().describe("Webhook URL for payment notifications"),
      custom: z.string().optional().describe("Custom data to pass through to webhook"),
    },
    async (params) => {
      try {
        return json(await client.post("/payments/form", params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "payment-search-tokens",
    "Search saved credit card tokens associated with clients. (POST /payments/tokens/search)",
    {
      paymentNumber: z.string().optional().describe("Filter by card last 4 digits or payment number"),
      cardHolder: z.string().optional().describe("Filter by card holder name"),
      externalKey: z.string().optional().describe("Filter by external reference key"),
    },
    async (params) => {
      try {
        return json(await client.post("/payments/tokens/search", params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "payment-charge-token",
    "Charge a saved credit card token for a new payment. (POST /payments/tokens/:id/charge)",
    {
      id: z.string().describe("Credit card token ID to charge"),
      type: z.number().int().optional().describe("Document type to create on successful charge"),
      description: z.string().optional().describe("Charge description"),
      lang: LangEnum.optional(),
      currency: CurrencyEnum.optional(),
      vatType: z.number().int().optional(),
      amount: z.number().positive().optional().describe("Amount to charge"),
      maxPayments: z.number().int().positive().optional().describe("Number of installments"),
      income: z.array(IncomeItemSchema).optional().describe("Line items for the charge"),
      remarks: z.string().optional(),
      notifyUrl: z.string().url().optional().describe("Webhook URL for charge notifications"),
    },
    async ({ id, ...body }) => {
      try {
        return json(await client.post(`/payments/tokens/${id}/charge`, body));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "payment-create-link",
    "Create a payment link that can be shared with a client for self-service payment. (POST /payment/links)",
    {
      client: ClientSubSchema.optional().describe("Client to pre-fill on the payment page"),
      income: z.array(IncomeItemSchema).optional().describe("Line items for the payment"),
      currency: CurrencyEnum.optional(),
      lang: LangEnum.optional(),
      remarks: z.string().optional(),
    },
    async (params) => {
      try {
        return json(await client.post("/payment/links", params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "payment-get-link",
    "Get details of an existing payment link. (GET /payment/links/:id)",
    {
      id: z.string().describe("Payment link ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/payment/links/${id}`));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "payment-get-link-status",
    "Check the current status of a payment link (pending, paid, expired, etc.). (GET /payment/links/:id/status)",
    {
      id: z.string().describe("Payment link ID"),
    },
    async ({ id }) => {
      try {
        return json(await client.get(`/payment/links/${id}/status`));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
