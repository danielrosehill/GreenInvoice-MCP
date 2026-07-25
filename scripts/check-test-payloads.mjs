#!/usr/bin/env node
/**
 * Offline check of the sandbox test-document payload builder.
 *
 * Asserts the payloads `sandbox create_test_document` / `sandbox seed` generate
 * satisfy the API's structural requirements — no credentials or network needed,
 * so this runs anywhere. It cannot prove the sandbox accepts them; only that we
 * are not sending something known-invalid.
 *
 * Usage: npm run build && node scripts/check-test-payloads.mjs
 */

import { buildTestDocument, SEED_TYPES } from "../dist/tools.js";

const PAYMENT_REQUIRED_TYPES = new Set([320, 400, 405]);

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

function validate(label, doc) {
  console.log(`\n${label}`);
  check("has numeric type", typeof doc.type === "number", `got ${typeof doc.type}`);
  check("has ISO date", /^\d{4}-\d{2}-\d{2}$/.test(doc.date), doc.date);
  check("has client.name", typeof doc.client?.name === "string" && doc.client.name.length > 0);
  check("income is a non-empty array", Array.isArray(doc.income) && doc.income.length > 0);

  for (const [i, line] of (doc.income ?? []).entries()) {
    check(`income[${i}] has description/quantity/price`,
      typeof line.description === "string" &&
      typeof line.quantity === "number" &&
      typeof line.price === "number");
    check(`income[${i}] currency matches document`, line.currency === doc.currency,
      `${line.currency} vs ${doc.currency}`);
  }

  // Field-name traps documented in README: income not items, payment not
  // payments, remarks not notes, lang not language, emails not email.
  for (const wrong of ["items", "payments", "notes", "language", "email"]) {
    check(`does not use '${wrong}'`, !(wrong in doc));
  }

  if (PAYMENT_REQUIRED_TYPES.has(doc.type)) {
    check("payment array present (required for this type)",
      Array.isArray(doc.payment) && doc.payment.length > 0);
    for (const [i, p] of (doc.payment ?? []).entries()) {
      check(`payment[${i}] has date/type/price`,
        /^\d{4}-\d{2}-\d{2}$/.test(p.date) &&
        typeof p.type === "number" &&
        typeof p.price === "number");
      check(`payment[${i}] date is not in the future`, p.date <= new Date().toISOString().slice(0, 10),
        p.date);
    }
  } else {
    check("no payment array for a type that does not need one", !("payment" in doc));
  }
}

// Defaults only — create_test_document with no arguments at all.
validate("defaults (no arguments)", buildTestDocument());

// One of each type the seed action produces.
for (const type of SEED_TYPES) {
  validate(`seed type ${type}`, buildTestDocument({ type }));
}

// Overrides are honoured and do not break structure.
const overridden = buildTestDocument({
  type: 320,
  price: 250,
  quantity: 2,
  currency: "USD",
  lang: "he",
  clientName: "Override Ltd",
  clientEmails: ["nobody@example.com"],
  paymentType: 3,
  paymentAmount: 585,
  itemDescription: "Consulting",
});
validate("overrides (type 320, USD, explicit paymentAmount)", overridden);
check("currency override propagated to income", overridden.income[0].currency === "USD");
check("paymentAmount override honoured", overridden.payment[0].price === 585);
check("paymentType override honoured", overridden.payment[0].type === 3);
check("clientEmails passed through", Array.isArray(overridden.client.emails));

// addClient: false must not auto-create a client record.
check("addClient false disables auto-create",
  buildTestDocument({ addClient: false }).client.add === false);

console.log(failures === 0 ? "\nAll payload checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
