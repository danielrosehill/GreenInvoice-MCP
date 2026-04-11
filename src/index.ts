#!/usr/bin/env node

/**
 * Green Invoice MCP Server
 *
 * DISCLAIMER: This is an UNOFFICIAL, third-party MCP server for the Green Invoice API.
 * It is NOT affiliated with, endorsed by, or supported by Green Invoice (Optimax Ltd).
 * Use at your own risk. Always verify operations against the official Green Invoice dashboard.
 *
 * @see https://www.greeninvoice.co.il/api-docs/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GreenInvoiceClient } from "./client.js";
import { registerTools } from "./tools/index.js";

const API_ID = process.env.GREENINVOICE_API_ID;
const API_SECRET = process.env.GREENINVOICE_API_SECRET;
const SANDBOX = process.env.GREENINVOICE_SANDBOX === "true";

if (!API_ID || !API_SECRET) {
  console.error(
    "Error: GREENINVOICE_API_ID and GREENINVOICE_API_SECRET environment variables are required.\n" +
      "Get your API credentials from Green Invoice: My Account > Developer Tools > API Keys > Add Key"
  );
  process.exit(1);
}

const server = new McpServer({
  name: "greeninvoice-mcp",
  version: "0.1.0",
  description:
    "Unofficial MCP server for the Green Invoice API. Not affiliated with or endorsed by Green Invoice.",
});

const client = new GreenInvoiceClient(API_ID, API_SECRET, SANDBOX);

registerTools(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
