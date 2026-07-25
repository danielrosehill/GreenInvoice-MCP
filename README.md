# Green Invoice MCP Server

> **DISCLAIMER: This is an UNOFFICIAL, third-party MCP server. It is NOT affiliated with, endorsed by, or supported by Green Invoice (Optimax Ltd). Use at your own risk. Always verify operations against the official Green Invoice dashboard.**

An MCP (Model Context Protocol) server that provides AI assistants with access to the [Green Invoice](https://www.greeninvoice.co.il/) API for Israeli invoicing and accounting.

## Features

- **Full API coverage** -- All 66 Green Invoice API endpoints across 11 consolidated tools
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

## Available Tools (11 consolidated tools, 66 endpoints)

Each tool uses an `action` parameter to select the operation, and a `data` JSON string for request parameters.

| Tool | Actions | Description |
|------|---------|-------------|
| `account` | get, settings | Account info and settings |
| `business` | list, get, update, get_numbering, set_numbering, get_footer, get_types, upload_file, delete_file | Business configuration and management |
| `document` | search, get, create, update, close, open, send, download_links, add_payment, preview, get_linked, get_info, get_types, get_statuses, search_payments | Full document lifecycle (invoices, receipts, quotes, etc.) |
| `client` | search, get, create, update, delete, associate_docs, merge, update_balance | Client management |
| `supplier` | search, get, create, update, delete, merge | Supplier management (for expenses) |
| `item` | search, get, create, update, delete | Product/service catalog |
| `expense` | search, get, create, update, delete, open, close, get_statuses, get_classifications, search_drafts | Expense tracking and reporting |
| `payment` | get_form, search_tokens, charge_token, create_link, get_link, get_link_status | Online payments and payment links |
| `webhook` | create, get, delete | Webhook subscriptions |
| `reference_data` | occupations, countries, cities, currencies | Reference/lookup data (no auth required) |
| `partner` | list, get, connect, disconnect | Partner/representative connections (multi-tenant CPA) |

## Document Type Reference

Complete list as returned by `GET /documents/types` (verified against the live API, 2026-07-23):

| Code | Type |
|------|------|
| 10 | Price Quotation |
| 20 | Bill / Payment Confirmation |
| 100 | Order (sales order / order confirmation) |
| 200 | Delivery Note |
| 210 | Return Delivery |
| 300 | Proforma Invoice (חשבון עסקה) |
| 305 | Tax Invoice |
| 320 | Tax Invoice + Receipt |
| 330 | Credit Note (Refund) |
| 400 | Receipt |
| 405 | Donation Receipt |
| 410 | Cancel Donation |
| 500 | Purchase Order (הזמנת רכש, issued to a supplier) |
| 600 | Deposit Receipt |
| 610 | Deposit Withdrawal |

There is no RFQ (request-for-quotation) document type — quotations are outbound only. For type 500 the document's `client` object holds the supplier being ordered from; supplier records themselves are managed with the `supplier` tool (search, get, create, update, delete, merge).

## Important API Notes

- Field names differ from what you might expect: use `income` (not `items`), `payment` (not `payments`), `remarks` (not `notes`), `lang` (not `language`), `emails` (array, not `email`)
- Document types 320, 400, and 405 **require** a payment array
- Payment dates cannot be in the future for receipt-type documents
- Set `client.add = true` to auto-create a client during document creation
- Token lasts ~30 minutes; the server handles refresh automatically

## API Reference

See [API_REFERENCE.md](API_REFERENCE.md) for the complete endpoint reference (66 endpoints), enum codes, and field documentation. Sourced from the [Apiary blueprint](https://www.greeninvoice.co.il/api-docs/), last updated 2026-03-11.

## MCP Validation Notes

- **03/04/2026**: Consolidated from 29 individual tools to 10 resource-based tools. Added full API coverage (66 endpoints) including suppliers, expenses, payments, partners reference data, and previously missing document/business/client endpoints. API spec sourced from Apiary blueprint (updated 2026-03-11).
- **01/04/2026**: Validated against the [Green Invoice API docs](https://www.greeninvoice.co.il/api-docs/). Basic business document functions tested: create invoice/receipt, issue. All tools worked as expected.
  - Removed `delete_document` tool -- not supported by the API (no `DELETE /documents/{id}` endpoint exists).

## License

MIT

---

**This project is not affiliated with, endorsed by, or supported by Green Invoice (Optimax Ltd). "Green Invoice" is a trademark of its respective owner. This is an independent, community-developed integration.**
