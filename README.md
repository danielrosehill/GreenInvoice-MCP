# Green Invoice MCP Server

> **DISCLAIMER: This is an UNOFFICIAL, third-party MCP server. It is NOT affiliated with, endorsed by, or supported by Green Invoice (Optimax Ltd). Use at your own risk. Always verify operations against the official Green Invoice dashboard.**

An MCP (Model Context Protocol) server that provides AI assistants with access to the [Green Invoice](https://www.greeninvoice.co.il/) API for Israeli invoicing and accounting.

## Features

- **Full API coverage** -- All 66 Green Invoice API endpoints across 43 purpose-specific tools
- **Documents** -- Create, search, update, close, reopen, send, preview invoices, receipts, quotes, and all document types
- **Clients** -- Full client management (CRUD, search, merge, balance, document association)
- **Suppliers** -- Supplier management for expense tracking (CRUD, search, merge)
- **Items** -- Product/service catalog management
- **Expenses** -- Expense tracking, drafts, accounting classifications
- **Payments** -- Payment forms, credit card tokens, payment links
- **Webhooks** -- Manage webhook subscriptions
- **Account & Business** -- Account info, settings, business config, numbering, file uploads
- **Reference Data** -- Business categories, countries, cities, exchange rates
- Automatic JWT token management with caching and refresh
- Built-in rate limiting (~3 req/s to match API limits)
- Sandbox mode support for testing

## Prerequisites

You need API credentials from Green Invoice:

1. Log into your Green Invoice account
2. Go to **My Account** > **Developer Tools** > **API Keys**
3. Click **Add Key** to generate an API ID and Secret

## Installation

### From npm

```bash
npm install -g greeninvoice-mcp
```

### From source

```bash
git clone https://github.com/danielrosehill/GreenInvoice-MCP.git
cd GreenInvoice-MCP
npm install
npm run build
```

## Configuration

The server requires these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `GREENINVOICE_API_ID` | Yes | Your Green Invoice API key ID |
| `GREENINVOICE_API_SECRET` | Yes | Your Green Invoice API key secret |
| `GREENINVOICE_SANDBOX` | No | Set to `true` to use the sandbox environment |

## MCP Client Configuration

To add this server to any MCP-compatible client:

```json
{
  "mcpServers": {
    "greeninvoice": {
      "command": "npx",
      "args": ["-y", "greeninvoice-mcp"],
      "env": {
        "GREENINVOICE_API_ID": "your-api-id-here",
        "GREENINVOICE_API_SECRET": "your-api-secret-here"
      },
      "description": "Green Invoice API for Israeli invoicing and accounting",
      "type": "stdio"
    }
  }
}
```

For sandbox/testing, add `"GREENINVOICE_SANDBOX": "true"` to the `env` object.

## Usage with Claude Code

Add to your Claude Code MCP settings (`~/.claude/settings.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "greeninvoice": {
      "command": "npx",
      "args": ["-y", "greeninvoice-mcp"],
      "env": {
        "GREENINVOICE_API_ID": "your-api-id-here",
        "GREENINVOICE_API_SECRET": "your-api-secret-here"
      }
    }
  }
}
```

For sandbox/testing:

```json
{
  "mcpServers": {
    "greeninvoice": {
      "command": "npx",
      "args": ["-y", "greeninvoice-mcp"],
      "env": {
        "GREENINVOICE_API_ID": "your-api-id-here",
        "GREENINVOICE_API_SECRET": "your-api-secret-here",
        "GREENINVOICE_SANDBOX": "true"
      }
    }
  }
}
```

### Running from source with Claude Code

If you cloned the repo locally:

```json
{
  "mcpServers": {
    "greeninvoice": {
      "command": "node",
      "args": ["/path/to/GreenInvoice-MCP/dist/index.js"],
      "env": {
        "GREENINVOICE_API_ID": "your-api-id-here",
        "GREENINVOICE_API_SECRET": "your-api-secret-here"
      }
    }
  }
}
```

## Available Tools (43 tools, 66 endpoints)

Each tool has fully typed input parameters — the AI assistant can see every available field, its type, and a description. No more passing opaque JSON strings.

### Account
| Tool | Description |
|------|-------------|
| `account-get` | Get account information (GET /account/me) |
| `account-get-settings` | Get account settings (GET /account/settings) |

### Business
| Tool | Description |
|------|-------------|
| `business-list` | List all businesses (GET /businesses) |
| `business-get-info` | Get business, numbering, footer, or types (action: get/numbering/footer/types) |
| `business-update` | Update business or manage files (action: update/set-numbering/upload-file/delete-file) |

### Documents
| Tool | Description |
|------|-------------|
| `document-search` | Search documents by type, status, date, client, etc. |
| `document-search-payments` | Search payment transactions within documents |
| `document-get` | Get a document by ID |
| `document-get-linked` | Get documents linked to a document |
| `document-get-download-links` | Get PDF download URLs |
| `document-get-reference` | Get document types, statuses, or type info (action: types/statuses/info) |
| `document-create` | Create a new document with fully typed fields |
| `document-preview` | Preview a document as base64 PDF |
| `document-update` | Update an existing draft document |
| `document-close` | Close (finalize) a document |
| `document-open` | Reopen a manually-closed document |
| `document-send` | Send a document to the client via email |
| `document-add-payment` | Record a payment received against a document |

### Clients
| Tool | Description |
|------|-------------|
| `client-search` | Search clients |
| `client-get` | Get a client by ID |
| `client-manage` | Create, update, delete, merge, or associate documents (action: create/update/delete/merge/associate-docs/update-balance) |

### Suppliers
| Tool | Description |
|------|-------------|
| `supplier-search` | Search suppliers |
| `supplier-get` | Get a supplier by ID |
| `supplier-manage` | Create, update, delete, or merge suppliers (action: create/update/delete/merge) |

### Items (Product/Service Catalog)
| Tool | Description |
|------|-------------|
| `item-search` | Search catalog items |
| `item-manage` | Get, create, update, or delete items (action: get/create/update/delete) |

### Expenses
| Tool | Description |
|------|-------------|
| `expense-search` | Search expenses or expense drafts (action: expenses/drafts) |
| `expense-get` | Get an expense by ID |
| `expense-get-reference` | Get expense statuses or accounting classifications (action: statuses/classifications) |
| `expense-manage` | Create, update, delete, open, or close expenses (action: create/update/delete/open/close) |

### Payments
| Tool | Description |
|------|-------------|
| `payment-get-form` | Generate a hosted payment form URL |
| `payment-search-tokens` | Search saved credit card tokens |
| `payment-charge-token` | Charge a saved credit card token |
| `payment-create-link` | Create a shareable payment link |
| `payment-get-link` | Get payment link details |
| `payment-get-link-status` | Check payment link status |

### Webhooks
| Tool | Description |
|------|-------------|
| `webhook-create` | Create a webhook subscription |
| `webhook-get` | Get a webhook by ID |
| `webhook-delete` | Delete a webhook |

### Reference Data (no authentication required)
| Tool | Description |
|------|-------------|
| `reference-get-occupations` | Get business category/occupation types |
| `reference-get-countries` | Get supported countries |
| `reference-get-cities` | Get cities for a given country |
| `reference-get-currencies` | Get current exchange rates |

## Document Type Reference

| Code | Type |
|------|------|
| 10 | Price Quote |
| 100 | Order |
| 200 | Delivery Note |
| 305 | Tax Invoice |
| 320 | Tax Invoice + Receipt |
| 330 | Credit Invoice (Refund) |
| 400 | Receipt |
| 405 | Donation Receipt |

## Important API Notes

- Field names differ from what you might expect: use `income` (not `items`), `payment` (not `payments`), `remarks` (not `notes`), `lang` (not `language`), `emails` (array, not `email`)
- Document types 320, 400, and 405 **require** a payment array
- Payment dates cannot be in the future for receipt-type documents
- Set `client.add = true` to auto-create a client during document creation
- Token lasts ~30 minutes; the server handles refresh automatically

## API Reference

See [API_REFERENCE.md](API_REFERENCE.md) for the complete endpoint reference (66 endpoints), enum codes, and field documentation. Sourced from the [Apiary blueprint](https://www.greeninvoice.co.il/api-docs/), last updated 2026-03-11.

## MCP Validation Notes

- **11/04/2026**: Refactored from 10 consolidated tools with untyped `data: string` parameters to 43 purpose-specific tools with fully typed Zod schemas. Each tool now exposes every available field with its type and description, giving AI assistants full schema visibility. Source split into `src/tools/` directory by resource group.
- **03/04/2026**: Consolidated from 29 individual tools to 10 resource-based tools. Added full API coverage (66 endpoints) including suppliers, expenses, payments, partners reference data, and previously missing document/business/client endpoints. API spec sourced from Apiary blueprint (updated 2026-03-11).
- **01/04/2026**: Validated against the [Green Invoice API docs](https://www.greeninvoice.co.il/api-docs/). Basic business document functions tested: create invoice/receipt, issue. All tools worked as expected.
  - Removed `delete_document` tool -- not supported by the API (no `DELETE /documents/{id}` endpoint exists).

## License

MIT

---

**This project is not affiliated with, endorsed by, or supported by Green Invoice (Optimax Ltd). "Green Invoice" is a trademark of its respective owner. This is an independent, community-developed integration.**
