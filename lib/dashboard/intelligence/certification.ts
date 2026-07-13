import type { DashboardInsightModel } from "./types";
import { normalizeCurrencyCode } from "./currency";

export type DashboardIntelligenceCertification = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

function isFiniteMinor(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

/**
 * Runtime integrity gate for the canonical dashboard intelligence model.
 * It never compares or combines monetary values across currencies.
 */
export function certifyDashboardInsightModel(
  model: DashboardInsightModel
): DashboardIntelligenceCertification {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenCurrencies = new Set<string>();

  for (const currency of model.currencies) {
    const normalizedCode = normalizeCurrencyCode(currency.currencyCode);

    if (!normalizedCode) {
      errors.push("A currency insight is missing a valid currency code.");
      continue;
    }

    if (seenCurrencies.has(normalizedCode)) {
      errors.push(`Duplicate currency insight detected for ${normalizedCode}.`);
    }
    seenCurrencies.add(normalizedCode);

    if (currency.currencyCode !== normalizedCode) {
      errors.push(`Currency code ${currency.currencyCode} is not normalized.`);
    }

    const monetaryValues = [
      currency.balanceMinor,
      currency.incomeMinor,
      currency.expenseMinor,
      currency.netMinor,
      currency.budget.allocatedMinor,
      currency.budget.actualMinor,
      currency.budget.remainingMinor,
      currency.forecast.currentBalanceMinor,
      currency.forecast.scheduledIncomeMinor,
      currency.forecast.scheduledExpenseMinor,
      currency.forecast.projectedBalanceMinor,
    ];

    if (monetaryValues.some((value) => !isFiniteMinor(value))) {
      errors.push(`${normalizedCode} contains a non-integer or non-finite minor-unit value.`);
    }

    if (currency.netMinor !== currency.incomeMinor - currency.expenseMinor) {
      errors.push(`${normalizedCode} net cash flow does not reconcile with income minus expenses.`);
    }

    if (currency.health.score < 0 || currency.health.score > 100) {
      errors.push(`${normalizedCode} health score is outside the 0–100 range.`);
    }

    if (currency.budget.scored !== currency.budget.healthy + currency.budget.atRisk + currency.budget.over) {
      errors.push(`${normalizedCode} scored budget counts do not reconcile.`);
    }

    if (currency.budget.total !== currency.budget.scored + currency.budget.unscored) {
      errors.push(`${normalizedCode} total budget count does not reconcile.`);
    }

    for (const transaction of [currency.largestIncome, currency.largestExpense]) {
      if (transaction && normalizeCurrencyCode(transaction.currencyCode) !== normalizedCode) {
        errors.push(`${normalizedCode} contains a largest-transaction summary from another currency.`);
      }
    }

    if (currency.forecast.availability === "available") {
      const expectedProjection =
        currency.forecast.currentBalanceMinor +
        currency.forecast.scheduledIncomeMinor -
        currency.forecast.scheduledExpenseMinor;
      if (currency.forecast.projectedBalanceMinor !== expectedProjection) {
        errors.push(`${normalizedCode} forecast projection does not reconcile.`);
      }
    }
  }

  const activeCodes = new Set(model.activeCurrencyCodes.map(normalizeCurrencyCode));
  for (const code of activeCodes) {
    if (!seenCurrencies.has(code)) {
      errors.push(`Active currency ${code} has no matching currency insight.`);
    }
  }

  for (const code of [model.weakestCurrencyCode, model.strongestCurrencyCode]) {
    if (code && !seenCurrencies.has(normalizeCurrencyCode(code))) {
      errors.push(`Ranked currency ${code} has no matching currency insight.`);
    }
  }

  if (model.currencies.length === 0 && model.metadata.sourceWalletCount > 0) {
    warnings.push("Wallets were loaded but no currency insights were generated.");
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}
