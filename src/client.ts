/**
 * Green Invoice API client with automatic token management.
 *
 * DISCLAIMER: This is an unofficial, third-party client.
 * Not affiliated with or endorsed by Green Invoice.
 */

export const PRODUCTION_BASE = "https://api.greeninvoice.co.il/api/v1";
export const SANDBOX_BASE = "https://sandbox.d.greeninvoice.co.il/api/v1";

const TOKEN_TTL_MS = 25 * 60 * 1000; // 25 minutes (tokens last ~30 min)
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

    const res = await fetch(`${this.baseUrl}/account/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: this.apiId, secret: this.apiSecret }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const token = data.token || res.headers.get("X-Authorization-Bearer");

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
