import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCurrencyFlows,
  sumCurrencyAmounts,
} from "../lib/finance/currencyTotals.ts";

test("buildCurrencyFlows never combines currencies", () => {
  const result = buildCurrencyFlows([
    { type: "income", amount_minor: 100_00, currency_code: "usd" },
    { type: "expense", amount_minor: 25_00, currency_code: " USD " },
    { type: "income", amount_minor: 500_00, currency_code: "SSP" },
  ]);

  assert.deepEqual(result, [
    {
      currencyCode: "SSP",
      incomeMinor: 500_00,
      expenseMinor: 0,
      netMinor: 500_00,
      transactionCount: 1,
    },
    {
      currencyCode: "USD",
      incomeMinor: 100_00,
      expenseMinor: 25_00,
      netMinor: 75_00,
      transactionCount: 2,
    },
  ]);
});

test("sumCurrencyAmounts groups and normalizes currencies", () => {
  assert.deepEqual(
    sumCurrencyAmounts([
      { currencyCode: "usd", amountMinor: 10_00 },
      { currencyCode: " USD ", amountMinor: 15_00 },
      { currencyCode: "KES", amountMinor: -2_00 },
    ]),
    [
      { currencyCode: "KES", amountMinor: -2_00 },
      { currencyCode: "USD", amountMinor: 25_00 },
    ]
  );
});

test("unsafe and unlabelled money values are excluded", () => {
  assert.deepEqual(
    sumCurrencyAmounts([
      { currencyCode: "", amountMinor: 100 },
      { currencyCode: "USD", amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    ]),
    []
  );
});
