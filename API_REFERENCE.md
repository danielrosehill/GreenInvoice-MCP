# Green Invoice API Reference

> Source: [Apiary Blueprint](https://jsapi.apiary.io/apis/greeninvoice.json) | Last updated: 2026-03-11  
> Production base: `https://api.greeninvoice.co.il/api/v1/`  
> Sandbox base: `https://sandbox.d.greeninvoice.co.il/api/v1/` — mirrors every path below, but is a **separate tenancy: production keys get `401` there**. See [docs/sandbox.md](docs/sandbox.md).  
> Reference data base: `https://cache.greeninvoice.co.il/`

## Endpoints (66 total)

### Businesses (10)

| Method | Path | Description |
|--------|------|-------------|
| GET | /businesses | List all user businesses |
| PUT | /businesses | Update business |
| GET | /businesses/me | Get current business |
| GET | /businesses/{id} | Get business by ID |
| POST | /businesses/file | Upload file (logo, signature, deduction/bookkeeping doc) - base64 |
| DELETE | /businesses/file | Delete business file |
| GET | /businesses/numbering | Get document numbering |
| PUT | /businesses/numbering | Set initial document numbering |
| GET | /businesses/footer | Get document footer text |
| GET | /businesses/types?lang= | Get business types |

### Clients (8)

| Method | Path | Description |
|--------|------|-------------|
| POST | /clients | Add client |
| GET | /clients/{id} | Get client |
| PUT | /clients/{id} | Update client |
| DELETE | /clients/{id} | Delete client (must be inactive) |
| POST | /clients/search | Search clients |
| POST | /clients/{id}/assoc | Associate documents to client |
| POST | /clients/{id}/merge | Merge clients (one must be inactive) |
| POST | /clients/{id}/balance | Update client balance |

### Suppliers (6)

| Method | Path | Description |
|--------|------|-------------|
| POST | /suppliers | Add supplier |
| GET | /suppliers/{id} | Get supplier |
| PUT | /suppliers/{id} | Update supplier |
| DELETE | /suppliers/{id} | Delete supplier |
| POST | /suppliers/search | Search suppliers |
| POST | /suppliers/{id}/merge | Merge suppliers |

### Items (5)

| Method | Path | Description |
|--------|------|-------------|
| POST | /items | Add item |
| GET | /items/{id} | Get item |
| PUT | /items/{id} | Update item |
| DELETE | /items/{id} | Delete item |
| POST | /items/search | Search items |

### Documents (15)

| Method | Path | Description |
|--------|------|-------------|
| POST | /documents | Create document |
| POST | /documents/preview | Preview document (returns base64 PDF) |
| GET | /documents/{id} | Get document |
| POST | /documents/search | Search documents |
| POST | /documents/payments/search | Search payments in documents |
| POST | /documents/{id}/close | Close document |
| POST | /documents/{id}/open | Reopen document |
| GET | /documents/{id}/linked | Get linked documents |
| GET | /documents/{id}/download/links | Get download links (he, en, origin) |
| GET | /documents/info?type= | Get document info for type |
| GET | /documents/templates | Get document templates |
| GET | /documents/types?lang= | Get document types |
| GET | /documents/statuses?lang= | Get document statuses |
| POST | /documents/{id}/payment | Add payment to document |
| POST | /documents/{id}/send | Send document via email |

### Expenses (13)

| Method | Path | Description |
|--------|------|-------------|
| POST | /expenses | Add expense |
| GET | /expenses/{id} | Get expense |
| PUT | /expenses/{id} | Update expense (not if reported) |
| DELETE | /expenses/{id} | Delete expense |
| POST | /expenses/search | Search expenses |
| POST | /expenses/{id}/open | Open expense |
| POST | /expenses/{id}/close | Close/report expense |
| GET | /expenses/statuses | Get expense statuses |
| GET | /accounting/classifications/map | Get accounting classifications |
| GET | /expenses/file | Get file upload URL (S3 presigned) |
| POST | /expenses/example | Create expense draft via file |
| POST | /expenses/example | Update expense file |
| POST | /expenses/drafts/search | Search expense drafts |

### Payments (3)

| Method | Path | Description |
|--------|------|-------------|
| POST | /payments/form | Get payment form URL |
| POST | /payments/tokens/search | Search credit card tokens |
| POST | /payments/tokens/{id}/charge | Charge credit card token |

### Partners (4)

| Method | Path | Description |
|--------|------|-------------|
| GET | /partners/users | Get all connected users |
| POST | /partners/users/connection | Request user approval |
| GET | /partners/users?email= | Get connected user by email |
| DELETE | /partners/users/connection?email= | Disconnect partner user |

### Reference/Tools (4)

| Method | Base URL | Path | Description |
|--------|----------|------|-------------|
| GET | cache.greeninvoice.co.il | /businesses/v1/occupations?locale= | Business categories |
| GET | cache.greeninvoice.co.il | /geo-location/v1/countries?locale= | Countries |
| GET | cache.greeninvoice.co.il | /geo-location/v1/cities?locale=&country= | Cities |
| GET | cache.greeninvoice.co.il | /currency-exchange/v1/latest?base= | Exchange rates |

## Enum Reference

### Document Types
| Code | Type |
|------|------|
| 10 | Price Quote |
| 100 | Order |
| 200 | Delivery Note |
| 210 | Return Delivery Note |
| 300 | Transaction Account |
| 305 | Tax Invoice |
| 320 | Tax Invoice + Receipt |
| 330 | Credit Invoice |
| 400 | Receipt |
| 405 | Donation Receipt |
| 500 | Purchase Order |
| 600 | Deposit Receipt |
| 610 | Deposit Withdrawal |

### Document Statuses
| Code | Status |
|------|--------|
| 0 | Open |
| 1 | Closed |
| 2 | Manually Closed |
| 3 | Canceling |
| 4 | Canceled |

### Payment Types
| Code | Type |
|------|------|
| -1 | Unpaid |
| 0 | Deduction at Source |
| 1 | Cash |
| 2 | Check |
| 3 | Credit Card |
| 4 | Bank Transfer |
| 5 | PayPal |
| 10 | Payment App |
| 11 | Other |

### Expense Statuses
| Code | Status |
|------|--------|
| 10 | Open |
| 20 | Reported |

### Expense Document Types
> **Corrected 2026-07-24:** the live `/expenses` endpoint does **not** accept a `10/20/30/40`
> enum (the old Apiary blueprint value below is stale — `30` returns error 3308 "invalid expense
> document type"). `documentType` on expenses uses the **same document-type codes as documents**
> (see the Document Types table above): e.g. `305`=Tax Invoice, `320`=Tax Invoice+Receipt
> (חשבונית מס קבלה), `400`=Receipt. Expense `create` also **requires** `reportingDate` (else 3310
> "invalid reporting month") and an `accountingClassification` (else 3312 "please fill in expense
> type details"; get valid ids via `GET /accounting/classifications/map`).

Stale blueprint values (do not use for `/expenses`):

| Code | Type |
|------|------|
| 10 | Invoice |
| 20 | Receipt |
| 30 | Invoice + Receipt |
| 40 | Other |

### VAT Types
| Code | Type |
|------|------|
| 0 | Default (before VAT) |
| 1 | VAT included |
| 2 | VAT exempt |

### Currencies (28 supported)
ILS, USD, EUR, GBP, JPY, CHF, CNY, AUD, CAD, DKK, NOK, ZAR, SEK, CZK, IMP, JOD, LBP, EGP, HRK, HUF, INR, RUB, TRY, UAH, BRL, PLN, RON, MXN

## Key API Notes

- Field names: use `income` (not `items`), `payment` (not `payments`), `remarks` (not `notes`), `lang` (not `language`), `emails` (array, not `email`)
- Document types 320, 400, 405 **require** a payment array
- Payment dates cannot be in the future for receipt-type documents
- Set `client.add = true` to auto-create a client during document creation
- JWT tokens last ~30 minutes; re-authenticate via `POST /account/token` with `{id, secret}`
- Rate limit: ~3 requests/second
- Only inactive clients/suppliers can be deleted
- Expenses cannot be updated once reported (status=20)
