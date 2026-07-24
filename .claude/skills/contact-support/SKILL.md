---
name: contact-support
description: Contact Morning (formerly Green Invoice) support by email at support@morning.co. Triggers on "contact green invoice support", "email morning support", "open a greeninvoice support ticket", "report a greeninvoice api bug".
---

# Contact Morning (Green Invoice) Support

Send a support request to **support@morning.co** — Morning is the current brand of Green Invoice
(חשבונית ירוקה). Use this when an issue can't be resolved from `API_REFERENCE.md` or the tool docs.

## When to use
- An API call returns an error code you can't resolve locally (e.g. a `330x`/`331x` expense error).
- Account, subscription, billing, or numbering questions.
- Reporting an API bug or a docs/behaviour discrepancy, or requesting a feature.

## What to include (so support can act on the first reply)
- **Business ID** and account email — get them from the `business` / `account` tools.
- The **exact endpoint**, **errorCode**, and **errorMessage** (Hebrew text + numeric code).
- A **minimal reproduction**: the request payload with any secrets/API keys redacted.
- **Expected vs actual** behaviour, and the date/time it occurred.

## How to send
Compose an email to `support@morning.co` and send it with whatever email tool is configured in
this environment (e.g. a Gmail/Workspace or Resend MCP). Keep the subject a one-line summary and
the body factual. Morning support replies in Hebrew or English.

## After a resolved API discrepancy
If support confirms the API behaves differently from our docs, update `API_REFERENCE.md` (and the
relevant tool description in `src/tools.ts`) with a dated correction, so the drift is captured in
the repo rather than rediscovered later.
