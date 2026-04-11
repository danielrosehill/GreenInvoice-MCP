import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CurrencyEnum, json, toolError } from "./schemas.js";

const CACHE_BASE = "https://cache.greeninvoice.co.il";

export function register(server: McpServer): void {

  server.tool(
    "reference-get-occupations",
    "Get the list of business category/occupation types for the Israeli market. No authentication required. (cache.greeninvoice.co.il/businesses/v1/occupations)",
    {
      locale: z.string().optional().default("he_IL").describe("Locale for labels (e.g. he_IL, en_US)"),
    },
    async ({ locale }) => {
      try {
        const res = await fetch(`${CACHE_BASE}/businesses/v1/occupations?locale=${locale}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return json(await res.json());
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "reference-get-countries",
    "Get the list of supported countries. No authentication required. (cache.greeninvoice.co.il/geo-location/v1/countries)",
    {
      locale: z.string().optional().default("he_IL").describe("Locale for country names (e.g. he_IL, en_US)"),
    },
    async ({ locale }) => {
      try {
        const res = await fetch(`${CACHE_BASE}/geo-location/v1/countries?locale=${locale}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return json(await res.json());
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "reference-get-cities",
    "Get the list of cities for a given country. No authentication required. (cache.greeninvoice.co.il/geo-location/v1/cities)",
    {
      locale: z.string().optional().default("he_IL").describe("Locale for city names (e.g. he_IL, en_US)"),
      country: z.string().optional().default("IL").describe("Country code to get cities for (default: IL)"),
    },
    async ({ locale, country }) => {
      try {
        const res = await fetch(`${CACHE_BASE}/geo-location/v1/cities?locale=${locale}&country=${country}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return json(await res.json());
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "reference-get-currencies",
    "Get current currency exchange rates. No authentication required. (cache.greeninvoice.co.il/currency-exchange/v1/latest)",
    {
      base: CurrencyEnum.optional().default("ILS").describe("Base currency for exchange rates (default: ILS)"),
    },
    async ({ base }) => {
      try {
        const res = await fetch(`${CACHE_BASE}/currency-exchange/v1/latest?base=${base}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return json(await res.json());
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
