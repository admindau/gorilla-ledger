import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMonthlyReview,
  buildMonthlyReviewCsv,
} from "../lib/retention/monthlyReview.ts";

test("monthly review keeps currency comparisons isolated", () => {
  const model = buildMonthlyReview({
    selectedYear: 2026,
    selectedMonth0: 6,
    currentBudgetCount: 1,
    transactions: [
      { type: "income", amount_minor: 200_00, currency_code: "USD", occurred_at: "2026-07-04" },
      { type: "expense", amount_minor: 50_00, currency_code: "USD", occurred_at: "2026-07-08" },
      { type: "expense", amount_minor: 80_00, currency_code: "USD", occurred_at: "2026-06-08" },
      { type: "income", amount_minor: 900_00, currency_code: "SSP", occurred_at: "2026-07-09" },
    ],
  });

  assert.deepEqual(model.entries.map((entry) => entry.currencyCode), ["SSP", "USD"]);
  const usd = model.entries.find((entry) => entry.currencyCode === "USD");
  assert.equal(usd?.current.netMinor, 150_00);
  assert.equal(usd?.previous.netMinor, -80_00);
  assert.equal(usd?.netChangeMinor, 230_00);
  assert.equal(usd?.expenseChangePercent, -38);
});

test("January review compares with December of the previous year", () => {
  const model = buildMonthlyReview({
    selectedYear: 2027,
    selectedMonth0: 0,
    currentBudgetCount: 0,
    transactions: [
      { type: "expense", amount_minor: 10_00, currency_code: "USD", occurred_at: "2026-12-31" },
      { type: "expense", amount_minor: 12_00, currency_code: "USD", occurred_at: "2027-01-01" },
    ],
  });
  assert.equal(model.previousLabel, "December 2026");
  assert.equal(model.previousTransactionCount, 1);
});

test("negative cash flow is prioritized above missing budget", () => {
  const model = buildMonthlyReview({
    selectedYear: 2026,
    selectedMonth0: 6,
    currentBudgetCount: 0,
    transactions: [
      { type: "income", amount_minor: 20_00, currency_code: "USD", occurred_at: "2026-07-01" },
      { type: "expense", amount_minor: 40_00, currency_code: "USD", occurred_at: "2026-07-02" },
    ],
  });
  assert.equal(model.primaryAction.id, "review-cash-flow");
});

test("missing current activity becomes the first follow-up", () => {
  const model = buildMonthlyReview({
    selectedYear: 2026,
    selectedMonth0: 6,
    currentBudgetCount: 2,
    transactions: [
      { type: "expense", amount_minor: 40_00, currency_code: "USD", occurred_at: "2026-06-02" },
    ],
  });
  assert.equal(model.primaryAction.id, "record-activity");
  assert.equal(model.hasPreviousActivity, true);
});

test("spending pressure is actionable when cash flow and budget are healthy", () => {
  const model = buildMonthlyReview({
    selectedYear: 2026,
    selectedMonth0: 6,
    currentBudgetCount: 1,
    transactions: [
      { type: "income", amount_minor: 500_00, currency_code: "USD", occurred_at: "2026-07-01" },
      { type: "expense", amount_minor: 150_00, currency_code: "USD", occurred_at: "2026-07-02" },
      { type: "income", amount_minor: 500_00, currency_code: "USD", occurred_at: "2026-06-01" },
      { type: "expense", amount_minor: 100_00, currency_code: "USD", occurred_at: "2026-06-02" },
    ],
  });
  assert.equal(model.primaryAction.id, "inspect-spending");
  assert.equal(model.entries[0].expenseChangePercent, 50);
});

test("monthly review export keeps explicit currency columns", () => {
  const model = buildMonthlyReview({
    selectedYear: 2026,
    selectedMonth0: 6,
    currentBudgetCount: 1,
    transactions: [
      { type: "income", amount_minor: 123_45, currency_code: "USD", occurred_at: "2026-07-01" },
    ],
  });
  const csv = buildMonthlyReviewCsv(model);
  assert.match(csv, /Currency,Current Income/);
  assert.match(csv, /USD,123\.45/);
  assert.doesNotMatch(csv, /\[object Object\]/);
});
