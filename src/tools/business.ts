import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GreenInvoiceClient } from "../client.js";
import { LangEnum, json, toolError } from "./schemas.js";

export function register(server: McpServer, client: GreenInvoiceClient): void {

  server.tool(
    "business-list",
    "List all businesses associated with the authenticated account. (GET /businesses)",
    {},
    async () => {
      try {
        return json(await client.get("/businesses"));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "business-get-info",
    `Read business information. Actions:
- "get": get a specific business by ID, or the current/default business if no ID provided
- "numbering": get current document numbering sequences
- "footer": get the document footer text
- "types": get list of business category types`,
    {
      action: z.enum(["get", "numbering", "footer", "types"]).describe("Information to retrieve"),
      id: z.string().optional().describe("Business ID (get action only; omit for current business)"),
      lang: LangEnum.optional().describe("Language for types list (types action only)"),
    },
    async ({ action, id, lang }) => {
      try {
        switch (action) {
          case "get":
            return json(await client.get(id ? `/businesses/${id}` : "/businesses/me"));
          case "numbering":
            return json(await client.get("/businesses/numbering"));
          case "footer":
            return json(await client.get("/businesses/footer"));
          case "types": {
            const query = lang ? `?lang=${lang}` : "";
            return json(await client.get(`/businesses/types${query}`));
          }
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "business-update",
    `Modify business data or files. Actions:
- "update": update business fields (name, address, bank details, etc.)
- "set-numbering": set initial document numbering sequences (e.g. {"305": 50001} sets Tax Invoice sequence start)
- "upload-file": upload a business file as base64 (type: "logo", "signature", "deduction", or "bookkeeping")
- "delete-file": delete a business file (type: "logo", "signature", "deduction", or "bookkeeping")`,
    {
      action: z.enum(["update", "set-numbering", "upload-file", "delete-file"]).describe("Action to perform"),
      // update fields
      name: z.string().optional().describe("Business name (update action)"),
      address: z.string().optional().describe("Street address (update action)"),
      city: z.string().optional().describe("City (update action)"),
      zip: z.string().optional().describe("Postal code (update action)"),
      country: z.string().optional().describe("Country code (update action)"),
      phone: z.string().optional().describe("Phone number (update action)"),
      taxId: z.string().optional().describe("Tax/business ID number (update action)"),
      bankName: z.string().optional().describe("Bank name (update action)"),
      bankBranch: z.string().optional().describe("Bank branch (update action)"),
      bankAccount: z.string().optional().describe("Bank account number (update action)"),
      // set-numbering fields
      numbering: z.record(z.string(), z.number().int()).optional().describe(
        "Numbering map by document type code, e.g. {\"305\": 50001} (set-numbering action)"
      ),
      // upload-file / delete-file fields
      fileType: z.enum(["logo", "signature", "deduction", "bookkeeping"]).optional().describe(
        "File type (upload-file and delete-file actions)"
      ),
      fileData: z.string().optional().describe("Base64-encoded file content (upload-file action)"),
    },
    async ({ action, name, address, city, zip, country, phone, taxId, bankName, bankBranch, bankAccount, numbering, fileType, fileData }) => {
      try {
        switch (action) {
          case "update": {
            const body: Record<string, unknown> = {};
            if (name !== undefined) body.name = name;
            if (address !== undefined) body.address = address;
            if (city !== undefined) body.city = city;
            if (zip !== undefined) body.zip = zip;
            if (country !== undefined) body.country = country;
            if (phone !== undefined) body.phone = phone;
            if (taxId !== undefined) body.taxId = taxId;
            if (bankName !== undefined) body.bankName = bankName;
            if (bankBranch !== undefined) body.bankBranch = bankBranch;
            if (bankAccount !== undefined) body.bankAccount = bankAccount;
            return json(await client.put("/businesses", body));
          }
          case "set-numbering":
            return json(await client.put("/businesses/numbering", numbering ?? {}));
          case "upload-file":
            return json(await client.post("/businesses/file", { type: fileType, file: fileData }));
          case "delete-file":
            return json(await client.request("DELETE", "/businesses/file", { type: fileType }));
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
