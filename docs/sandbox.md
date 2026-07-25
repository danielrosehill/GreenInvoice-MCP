# Green Invoice sandbox environment

How to reach Green Invoice's test environment from this MCP server, and what is
actually true about it. Findings below were probed directly against the live
hosts on **2026-07-25** unless marked otherwise.

## Endpoints

| Purpose | URL |
|---------|-----|
| Sandbox API base | `https://sandbox.d.greeninvoice.co.il/api/v1/` |
| Sandbox web app | `https://app.sandbox.d.greeninvoice.co.il/` |
| Production API base | `https://api.greeninvoice.co.il/api/v1/` |
| Reference data (no auth, shared) | `https://cache.greeninvoice.co.il/` |

`https://sandbox.d.greeninvoice.co.il/` (root, no `/api/v1`) returns **302** to
the sandbox web app — that redirect is how the app URL above was found; it is
not published in the API docs.

The sandbox mirrors the production URL structure exactly: the same 66 paths
documented in [API_REFERENCE.md](../API_REFERENCE.md) hang off the sandbox base.
`GET /api/v1/documents/types` returns **200** on the sandbox without any
authentication, which makes it a convenient liveness probe.

## The one thing that trips you up: separate credentials

**Production API keys do not work against the sandbox.** This is the single fact
worth knowing before anything else, because the failure looks like a broken key
rather than a wrong environment.

Verified 2026-07-25 with a live production key pair:

| Request | Result |
|---------|--------|
| `POST /account/token` on **production**, real key pair | `200` + `{"token":"…","expires":<unix>}` |
| `POST /account/token` on **sandbox**, *same* real key pair | `401` `{"errorCode":401,"errorMessage":"גישה נדחתה, נא להתחבר מחדש"}` |
| `POST /account/token` on **sandbox**, deliberately bogus id/secret | `401` — **byte-identical response** |

Because a valid-but-wrong-environment key and outright garbage produce the same
error, there is no way to tell from the response that the problem is the
environment. Anyone debugging this will assume the key is bad and go re-issue
it, which does not help.

The sandbox is therefore a fully separate tenancy, not a flag on your production
account. To use it you need a **sandbox account of its own**, registered at
`https://app.sandbox.d.greeninvoice.co.il/`, and an API key generated from
inside that account (My Account > Developer Tools > API Keys > Add Key).

Not yet confirmed (as of 2026-07-25): whether sandbox registration is
self-service or has to be requested from Green Invoice support, and whether
sandbox data is periodically wiped. If support has to be involved, the
`contact-support` skill in `.claude/skills/` drafts the request.

## Configuring this server

Two modes, in precedence order.

### Sandbox alongside production (recommended)

Set a second key pair; the ten production tools stay on production and the
`sandbox` tool gets its own client:

```bash
GREENINVOICE_API_ID=<production id>
GREENINVOICE_API_SECRET=<production secret>
GREENINVOICE_SANDBOX_API_ID=<sandbox id>
GREENINVOICE_SANDBOX_API_SECRET=<sandbox secret>
```

The `sandbox` tool's client is bound to `SANDBOX_BASE` at construction and has
no code path to production — it cannot write to the real books regardless of
what arguments it is given. The converse also holds: `document`, `expense` and
friends never touch the sandbox in this mode.

### Whole server in sandbox mode

```bash
GREENINVOICE_API_ID=<sandbox id>
GREENINVOICE_API_SECRET=<sandbox secret>
GREENINVOICE_SANDBOX=true
```

Every tool points at the sandbox, and the `sandbox` tool reuses that same client
(`status` reports `sharedWithMainClient: true`). Useful for a dedicated test
deployment; not useful when you want both environments in one session.

If neither is configured, the `sandbox` tool is still registered — its `status`
action returns `configured: false` plus setup instructions, and every other
action throws with the same guidance. That is deliberate: a tool that explains
its own absence beats a tool that silently isn't there.

## The `sandbox` tool

One action-based tool, matching the convention of the other ten.

| Action | What it does |
|--------|--------------|
| `status` | Config + credential check. Never throws on auth failure — returns `reachable: false` with the error. Start here. |
| `create_test_document` | Minimal spec → complete valid document. Every argument optional. |
| `seed` | One document of each of types 10, 300, 305, 320, 400. Populates an empty sandbox. Per-type results, failures included rather than aborting. |
| `create_document` | Full explicit payload, no defaults filled in. Same shape as `document` create. |
| `preview_document` | Base64 PDF, creates nothing. Cheapest payload validation. |
| `get_document`, `search_documents`, `download_links` | Read back what was created. |
| `create_test_client`, `search_clients` | Test client records. |
| `request` | `{method, path, body}` escape hatch to any of the 66 endpoints. |

There is deliberately **no `send` action**. Sandbox documents are fake but the
email delivery is not — a `POST /documents/{id}/send` in the sandbox would put
mail in a real inbox. Use `download_links` or `preview_document` instead.

### Defaults that `create_test_document` fills in

Type `305` (Tax Invoice), price `100`, quantity `1`, currency `ILS`, language
`en`, date today, client `"MCP Sandbox Test Client"` with `add: true` so the
client record is auto-created, and a `remarks` string marking the document as
test data. Every one is overridable.

For types **320, 400 and 405** the API rejects a document with no `payment`
array, so one is added automatically: today's date, type `4` (Bank Transfer),
amount defaulting to the line subtotal.

Inferred, not verified: with `vatType: 0` the line price is pre-VAT while the
document total is not, so the default payment amount is short by the VAT and
should leave the document **partially paid rather than closed**. It has not been
confirmed against a live sandbox whether Green Invoice accepts the underpayment
quietly or rejects the create outright. Pass `paymentAmount` explicitly to
settle in full and sidestep the question.

`scripts/check-test-payloads.mjs` asserts the generated payloads are
structurally valid offline — no credentials, no network. It checks the
field-name traps (`income` not `items`, `payment` not `payments`, `remarks` not
`notes`, `lang` not `language`, `emails` not `email`), that payment-requiring
types get a payment array and others do not, and that payment dates are never
in the future. It cannot tell you the sandbox will accept a payload, only that
we are not sending something known-broken.

## Deployment note

The `greeninvoice` server on the MCPJungle gateway (residenceserver, 10.0.0.2)
runs as **stdio via `npx -y greeninvoice-mcp`** — it consumes the published npm
package, not this working tree. Local changes do not reach the gateway until the
package is published and the server re-registered with `--force` (npx caches
resolved versions).

## Token handling

`POST /account/token` returns `{"token": "...", "expires": <unix seconds>}`. The
client currently ignores `expires` and assumes a fixed 25-minute TTL, refreshing
on that timer plus a one-shot retry on any `401`. That works, but the response
does carry the real expiry if tighter handling is ever wanted.
