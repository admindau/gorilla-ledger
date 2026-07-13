import { normalizeCurrencyCodes } from "./currency";
import type {
  CurrencyBudgetIntelligence,
  CurrencyForecastIntelligence,
  CurrencyHealthIntelligence,
  CurrencyInsight,
  CurrencyTrendIntelligence,
  DashboardInsightModel,
  DashboardIntelligenceSourceCounts,
  IntelligenceFilters,
} from "./types";

export const DASHBOARD_INTELLIGENCE_MODEL_VERSION = "1.0.0";

export function createEmptyTrend(): CurrencyTrendIntelligence {
  return {
    direction: "unavailable",
    currentMinor: 0,
    previousMinor: 0,
    absoluteChangeMinor: 0,
    percentageChange: null,
  };
}

export function createEmptyBudgetIntelligence(): CurrencyBudgetIntelligence {
  return {
    total: 0,
    scored: 0,
    unscored: 0,
    healthy: 0,
    atRisk: 0,
    over: 0,
    allocatedMinor: 0,
    actualMinor: 0,
    remainingMinor: 0,
    utilizationRatio: null,
    status: "unscored",
  };
}

export function createEmptyForecastIntelligence(): CurrencyForecastIntelligence {
  return {
    availability: "unavailable",
    currentBalanceMinor: 0,
    scheduledIncomeMinor: 0,
    scheduledExpenseMinor: 0,
    projectedBalanceMinor: 0,
    scheduledOccurrencesCount: 0,
    scheduledRuleCount: 0,
    windowStart: null,
    windowEnd: null,
  };
}

export function createEmptyHealthIntelligence(): CurrencyHealthIntelligence {
  return {
    score: 0,
    label: "No activity",
    riskLevel: "watch",
    budgetPressureCount: 0,
    hasActivity: false,
  };
}

export function createEmptyCurrencyInsight(currencyCode: string): CurrencyInsight {
  const normalizedCurrencyCode = currencyCode.trim().toUpperCase();

  return {
    currencyCode: normalizedCurrencyCode,
    balanceMinor: 0,
    incomeMinor: 0,
    expenseMinor: 0,
    netMinor: 0,
    transactionCount: 0,
    largestIncome: null,
    largestExpense: null,
    incomeTrend: createEmptyTrend(),
    expenseTrend: createEmptyTrend(),
    budget: createEmptyBudgetIntelligence(),
    forecast: createEmptyForecastIntelligence(),
    health: createEmptyHealthIntelligence(),
    alerts: [],
    recommendations: [],
  };
}

type CreateEmptyDashboardInsightModelInput = {
  filters: IntelligenceFilters;
  currencyCodes?: Iterable<string>;
  sourceCounts?: Partial<DashboardIntelligenceSourceCounts>;
  warnings?: string[];
  generatedAt?: Date;
};

/**
 * Creates a valid model shell for loading, empty-state, and incremental
 * migration paths. No currency is assumed or injected automatically.
 */
export function createEmptyDashboardInsightModel({
  filters,
  currencyCodes = [],
  sourceCounts = {},
  warnings = [],
  generatedAt = new Date(),
}: CreateEmptyDashboardInsightModelInput): DashboardInsightModel {
  const normalizedCurrencyCodes = normalizeCurrencyCodes(currencyCodes);
  const currencies = normalizedCurrencyCodes.map(createEmptyCurrencyInsight);

  return {
    metadata: {
      generatedAt: generatedAt.toISOString(),
      modelVersion: DASHBOARD_INTELLIGENCE_MODEL_VERSION,
      sourceTransactionCount: sourceCounts.transactions ?? 0,
      sourceWalletCount: sourceCounts.wallets ?? 0,
      sourceBudgetCount: sourceCounts.budgets ?? 0,
      sourceRecurringRuleCount: sourceCounts.recurringRules ?? 0,
      isComplete: warnings.length === 0,
      warnings: [...warnings],
    },
    filters,
    currencies,
    activeCurrencyCodes: normalizedCurrencyCodes,
    weakestCurrencyCode: null,
    strongestCurrencyCode: null,
    alerts: [],
    recommendations: [],
  };
}

export function isDashboardInsightModel(
  value: unknown
): value is DashboardInsightModel {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DashboardInsightModel>;

  return Boolean(
    candidate.metadata &&
      candidate.filters &&
      Array.isArray(candidate.currencies) &&
      Array.isArray(candidate.activeCurrencyCodes) &&
      Array.isArray(candidate.alerts) &&
      Array.isArray(candidate.recommendations)
  );
}
