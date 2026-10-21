# Authentication

Verified **2026-10-21** against production.

| Step | Endpoint | Notes |
|---|---|---|
| Get token | `POST https://api.morning.co/idp/v1/oauth/token` | JSON (or form / Basic) `{"grant_type":"client_credentials","client_id":<API key id>,"client_secret":<API key secret>}`. Response field **`accessToken`**, valid 60 min. Existing Green Invoice API keys work unchanged. |
| Call the API | `https://api.greeninvoice.co.il/api/v1/...` with `Authorization: Bearer <accessToken>` | The same token gets **403** on `api.morning.co/api/v1` and `apigw.greeninvoice.co.il/api/v1`. |
| Legacy token | `POST https://api.greeninvoice.co.il/api/v1/account/token` `{"id","secret"}` | Now **404 for every caller** (real and fake keys alike), so the old client failed with `Auth failed (404):` and an empty body. Kept as a fallback only. |
| Sandbox | `POST https://api.sandbox.morning.dev/idp/v1/oauth/token` | From morning-cli's docs; **not verified** here. |

How it was found: a 404 for fake credentials as well as real ones ruled out a revoked key;
`GET /businesses/me` without auth returned 401, so the API itself was alive and only the
token route had gone. The new route came from
[morning-cli](https://github.com/Jango-AI-com/morning-cli) (`MORNING_AUTH_MODE=auto`: OAuth
first, legacy fallback), the behaviour 0.3.2 copies. The old Apiary docs
(`greeninvoice.docs.apiary.io`) were also 404 on that date.
