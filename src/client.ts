/**
 * Green Invoice API client with automatic token management.
 *
 * DISCLAIMER: This is an unofficial, third-party client.
 * Not affiliated with or endorsed by Green Invoice.
 */

export const PRODUCTION_BASE = "https://api.greeninvoice.co.il/api/v1";
export const SANDBOX_BASE = "https://sandbox.d.greeninvoice.co.il/api/v1";
export const OAUTH_PRODUCTION = "https://api.morning.co/idp/v1/oauth/token";
export const OAUTH_SANDBOX = "https://api.sandbox.morning.dev/idp/v1/oauth/token";

const TOKEN_TTL_MS = 25 * 60 * 1000; // 25 minutes (OAuth tokens last 60 min, legacy ~30)
const MIN_REQUEST_INTERVAL_MS = 350; // ~3 req/s rate limit

interface TokenCache {
  token: string;
  obtainedAt: number;
}

export class GreenInvoiceClient {
  private apiId: string;
  private apiSecret: string;
  private baseUrl: string;
  private tokenCache: TokenCache | null = null;
  private lastRequestTime = 0;

  readonly sandbox: boolean;

  constructor(apiId: string, apiSecret: string, sandbox = false) {
    this.apiId = apiId;
    this.apiSecret = apiSecret;
    this.sandbox = sandbox;
    this.baseUrl = sandbox ? SANDBOX_BASE : PRODUCTION_BASE;
  }

  /** Which environment this client is bound to. Fixed at construction. */
  get environment(): "sandbox" | "production" {
    return this.sandbox ? "sandbox" : "production";
  }

  get base(): string {
    return this.baseUrl;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async getToken(): Promise<string> {
    if (
      this.tokenCache &&
      Date.now() - this.tokenCache.obtainedAt < TOKEN_TTL_MS
    ) {
      return this.tokenCache.token;
    }

    await this.rateLimit();

    // Since ~Oct 2026 Green Invoice (morning) issues tokens through an OAuth 2.0
    // client-credentials endpoint on api.morning.co; the old POST /account/token now
    // returns 404 for every caller (verified 2026-10-21 with real and fake keys).
    // Existing API key id/secret work unchanged as client_id/client_secret, and API
    // calls stay on api.greeninvoice.co.il. Fall back to the legacy route for
    // environments that still serve it (morning-cli does the same in "auto" mode).
    let token: string | null = null;
    const oauth = await fetch(this.sandbox ? OAUTH_SANDBOX : OAUTH_PRODUCTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.apiId,
        client_secret: this.apiSecret,
      }),
    });
    if (oauth.ok) {
      const data = await oauth.json();
      token = data.accessToken || data.access_token || null;
    }

    if (!token) {
      const res = await fetch(`${this.baseUrl}/account/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.apiId, secret: this.apiSecret }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Auth failed (oauth ${oauth.status}, legacy ${res.status}): ${text}`);
      }
      const data = await res.json();
      token = data.token || res.headers.get("X-Authorization-Bearer");
    }

    if (!token) {
      throw new Error("No token in auth response");
    }

    this.tokenCache = { token, obtainedAt: Date.now() };
    return token;
  }

  private invalidateToken(): void {
    this.tokenCache = null;
  }

  async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    await this.rateLimit();
    const token = await this.getToken();

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Retry once on 401 with fresh token
    if (res.status === 401) {
      this.invalidateToken();
      const freshToken = await this.getToken();
      const retry = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freshToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!retry.ok) {
        const text = await retry.text();
        throw new Error(`API error (${retry.status}): ${text}`);
      }
      return retry.json();
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error (${res.status}): ${text}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  }

  async get(path: string): Promise<unknown> {
    return this.request("GET", path);
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    return this.request("POST", path, body);
  }

  async put(path: string, body: unknown): Promise<unknown> {
    return this.request("PUT", path, body);
  }

  async delete(path: string): Promise<unknown> {
    return this.request("DELETE", path);
  }
}
