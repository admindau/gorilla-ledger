import assert from "node:assert/strict";
import test from "node:test";

import { buildDashboardReconciliation } from "../lib/dashboard/reconciliation.ts";
import {
  advanceRecurringDate,
  buildRecurringForecast,
} from "../lib/recurring/forecast.ts";

test("dashboard reconciliation preserves currency boundaries and reconciles net flow", () => {
  const entries = buildDashboardReconciliation({
    totalsByCurrency: { USD: 120_00, SSP: 900_00 },
    incomeByCurrency: { USD: 100_00, SSP: 500_00 },
    expenseByCurrency: { USD: 25_00, SSP: 100_00 },
    budgetStatsByCurrency: {},
    monthTransactions: [
      { id: "1", wallet_id: "w1", category_id: null, type: "income", amount_minor: 100_00, currency_code: "USD", occurred_at: "2026-07-01" },
      { id: "2", wallet_id: "w2", category_id: null, type: "expense", amount_minor: 100_00, currency_code: "SSP", occurred_at: "2026-07-02" },
    ],
  });

  assert.deepEqual(
    entries.map(({ currencyCode, incomeMinor, expenseMinor, netMinor }) => ({
      currencyCode,
      incomeMinor,
      expenseMinor,
      netMinor,
    })),
    [
      { currencyCode: "SSP", incomeMinor: 500_00, expenseMinor: 100_00, netMinor: 400_00 },
      { currencyCode: "USD", incomeMinor: 100_00, expenseMinor: 25_00, netMinor: 75_00 },
    ]
  );
});

test("monthly recurrence clamps to the final valid calendar day", () => {
  const result = advanceRecurringDate(
    new Date("2027-01-31T08:30:00.000Z"),
    "monthly",
    1,
    31
  );

  assert.equal(result.toISOString(), "2027-02-28T08:30:00.000Z");
});

test("recurring forecast keeps scheduled totals separated by currency", () => {
  const rules = [
    {
      id: "usd-rule",
      wallet_id: "w1",
      category_id: null,
      type: "expense",
      amount_minor: 25_00,
      currency_code: "USD",
      frequency: "monthly",
      interval: 1,
      day_of_month: 17,
      day_of_week: null,
      start_date: "2026-07-17",
      end_date: null,
      next_run_at: "2026-07-17T00:00:00.000Z",
      is_active: true,
    },
    {
      id: "ssp-rule",
      wallet_id: "w2",
      category_id: null,
      type: "income",
      amount_minor: 100_00,
      currency_code: "SSP",
      frequency: "monthly",
      interval: 1,
      day_of_month: 20,
      day_of_week: null,
      start_date: "2026-07-20",
      end_date: null,
      next_run_at: "2026-07-20T00:00:00.000Z",
      is_active: true,
    },
  ];

  const result = buildRecurringForecast(
    rules,
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-07-31T23:59:59.999Z")
  );

  assert.deepEqual(result.entries, [
    {
      currencyCode: "SSP",
      scheduledIncomeMinor: 100_00,
      scheduledExpenseMinor: 0,
      scheduledOccurrencesCount: 1,
      scheduledRuleIds: ["ssp-rule"],
    },
    {
      currencyCode: "USD",
      scheduledIncomeMinor: 0,
      scheduledExpenseMinor: 25_00,
      scheduledOccurrencesCount: 1,
      scheduledRuleIds: ["usd-rule"],
    },
  ]);
});
