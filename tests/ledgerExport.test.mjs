import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLedgerExports,
  protectSpreadsheetText,
} from "../lib/export/ledgerExport.ts";

const fixture = {
  wallets: [
    {
      id: "wallet-1",
      name: "Cash",
      type: "cash",
      currency_code: "USD",
      starting_balance_minor: 123_45,
      created_at: "2026-07-01T00:00:00Z",
      updated_at: "2026-07-01T00:00:00Z",
    },
  ],
  categories: [
    {
      id: "category-1",
      name: "Subscriptions",
      type: "expense",
      is_active: true,
      created_at: "2026-07-01T00:00:00Z",
    },
  ],
  transactions: [
    {
      id: "transaction-1",
      wallet_id: "wallet-1",
      category_id: "category-1",
      type: "expense",
      amount_minor: 25_00,
      currency_code: "USD",
      occurred_at: "2026-07-02T00:00:00Z",
      occurred_at_precision: "datetime",
      occurred_timezone: "Africa/Juba",
      description: "=HYPERLINK(\"https://example.test\")",
      created_at: "2026-07-02T00:00:00Z",
    },
  ],
  budgets: [],
  recurringRules: [],
};

test("export center creates all roadmap datasets", () => {
  const datasets = buildLedgerExports(fixture);
  assert.deepEqual(
    datasets.map((dataset) => dataset.id),
    ["transactions", "wallets", "categories", "budgets", "recurring"]
  );
  assert.equal(datasets.find((dataset) => dataset.id === "transactions")?.rowCount, 1);
});

test("transaction export resolves names and preserves explicit currency", () => {
  const csv = buildLedgerExports(fixture).find((dataset) => dataset.id === "transactions")?.csv ?? "";
  assert.match(csv, /Cash/);
  assert.match(csv, /Subscriptions/);
  assert.match(csv, /USD,2500,25/);
  assert.match(csv, /Time Precision,Event Timezone/);
  assert.match(csv, /datetime,Africa\/Juba/);
});

test("spreadsheet formulas from user text are neutralized", () => {
  assert.equal(protectSpreadsheetText("=2+2"), "'=2+2");
  assert.equal(protectSpreadsheetText("  @SUM(A1:A2)"), "'  @SUM(A1:A2)");
  const csv = buildLedgerExports(fixture).find((dataset) => dataset.id === "transactions")?.csv ?? "";
  assert.match(csv, /'=HYPERLINK/);
});

test("safe text remains unchanged", () => {
  assert.equal(protectSpreadsheetText("Salary"), "Salary");
  assert.equal(protectSpreadsheetText("2026-07-01"), "2026-07-01");
});
