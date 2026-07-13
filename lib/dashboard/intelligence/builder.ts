import type { CurrencyReconciliationEntry } from "@/lib/dashboard/reconciliation";
import type {
  BudgetReconciliationResult,
  ForecastReconciliationResult,
} from "@/lib/dashboard/budgetForecastReconciliation";
import {
  createEmptyBudgetIntelligence,
  createEmptyForecastIntelligence,
  createEmptyTrend,
  DASHBOARD_INTELLIGENCE_MODEL_VERSION,
} from "./model";
import type {
  CurrencyBudgetIntelligence,
  CurrencyForecastIntelligence,
  CurrencyHealthIntelligence,
  CurrencyInsight,
  DashboardInsightModel,
  IntelligenceAlert,
  IntelligenceFilters,
  IntelligenceRecommendation,
  IntelligenceRiskLevel,
  IntelligenceTransactionSummary,
} from "./types";
import { normalizeCurrencyCode, normalizeCurrencyCodes } from "./currency";
import { certifyDashboardInsightModel } from "./certification";

type TransactionPresentation = {
  categoryName: string | null;
  description: string | null;
};

type BuildDashboardInsightModelInput = {
  reconciliationEntries: CurrencyReconciliationEntry[];
  budgetReconciliation: BudgetReconciliationResult;
  forecastReconciliation: ForecastReconciliationResult;
  filters: IntelligenceFilters;
  sourceCounts: {
    transactions: number;
    wallets: number;
    budgets: number;
    recurringRules: number;
  };
  resolveTransactionPresentation?: (
    transaction: CurrencyReconciliationEntry["largestIncome"]
  ) => TransactionPresentation;
  generatedAt?: Date;
  warnings?: string[];
};

function toRiskLevel(
  riskLevel: CurrencyReconciliationEntry["health"]["riskLevel"]
): IntelligenceRiskLevel {
  switch (riskLevel) {
    case "Healthy":
      return "healthy";
    case "Warning":
      return "warning";
    case "Critical":
      return "critical";
    case "Watch":
    default:
      return "watch";
  }
}

function toTransactionSummary(
  transaction: CurrencyReconciliationEntry["largestIncome"],
  currencyCode: string,
  resolveTransactionPresentation?: BuildDashboardInsightModelInput["resolveTransactionPresentation"]
): IntelligenceTransactionSummary | null {
  if (!transaction) return null;

  const presentation = resolveTransactionPresentation?.(transaction) ?? {
    categoryName: null,
    description: null,
  };

  return {
    id: transaction.id,
    walletId: transaction.wallet_id,
    categoryId: transaction.category_id,
    categoryName: presentation.categoryName,
    description: presentation.description,
    direction: transaction.type,
    amountMinor: transaction.amount_minor,
    currencyCode,
    occurredAt: transaction.occurred_at,
  };
}

function buildBudgetIntelligence(
  currencyCode: string,
  budgetReconciliation: BudgetReconciliationResult
): CurrencyBudgetIntelligence {
  const summaries = budgetReconciliation.summaries.filter(
    (summary) => summary.isScorable && summary.currencyCode === currencyCode
  );

  if (summaries.length === 0) return createEmptyBudgetIntelligence();

  const stats = budgetReconciliation.statsByCurrency[currencyCode] ?? {
    total: 0,
    onTrack: 0,
    atRisk: 0,
    over: 0,
  };
  const allocatedMinor = summaries.reduce(
    (sum, summary) => sum + summary.budget.amount_minor,
    0
  );
  const actualMinor = summaries.reduce(
    (sum, summary) => sum + summary.actualMinor,
    0
  );
  const remainingMinor = allocatedMinor - actualMinor;
  const utilizationRatio =
    allocatedMinor > 0 ? actualMinor / allocatedMinor : null;

  return {
    total: stats.total,
    scored: stats.total,
    unscored: 0,
    healthy: stats.onTrack,
    atRisk: stats.atRisk,
    over: stats.over,
    allocatedMinor,
    actualMinor,
    remainingMinor,
    utilizationRatio,
    status:
      stats.over > 0
        ? "over"
        : stats.atRisk > 0
        ? "atRisk"
        : stats.total > 0
        ? "healthy"
        : "unscored",
  };
}

function buildForecastIntelligence(
  currencyCode: string,
  forecastReconciliation: ForecastReconciliationResult
): CurrencyForecastIntelligence {
  const entry = forecastReconciliation.entries.find(
    (candidate) => candidate.currencyCode === currencyCode
  );

  if (!entry) {
    return {
      ...createEmptyForecastIntelligence(),
      availability:
        forecastReconciliation.availability === "historical-unavailable"
          ? "historical-unavailable"
          : "unavailable",
      windowStart: forecastReconciliation.windowStart?.toISOString() ?? null,
      windowEnd: forecastReconciliation.windowEnd.toISOString(),
    };
  }

  return {
    availability:
      forecastReconciliation.availability === "historical-unavailable"
        ? "historical-unavailable"
        : "available",
    currentBalanceMinor: entry.currentBalanceMinor,
    scheduledIncomeMinor: entry.scheduledIncomeMinor,
    scheduledExpenseMinor: entry.scheduledExpenseMinor,
    projectedBalanceMinor: entry.projectedBalanceMinor,
    scheduledOccurrencesCount: entry.scheduledOccurrencesCount,
    scheduledRuleCount: entry.scheduledRuleCount,
    windowStart: forecastReconciliation.windowStart?.toISOString() ?? null,
    windowEnd: forecastReconciliation.windowEnd.toISOString(),
  };
}

function buildCurrencyAlerts(
  currencyCode: string,
  entry: CurrencyReconciliationEntry,
  budget: CurrencyBudgetIntelligence,
  periodLabel: string
): IntelligenceAlert[] {
  const alerts: IntelligenceAlert[] = [];

  if (entry.netMinor < 0) {
    alerts.push({
      id: `negative-cash-flow-${currencyCode}`,
      currencyCode,
      severity: "critical",
      title: `${currencyCode} cash flow is negative`,
      message: `Expenses exceed income for ${periodLabel}.`,
      metricKey: "netMinor",
      actionTarget: "transactions",
      actionLabel: "Review transactions",
    });
  } else if (entry.netMinor > 0) {
    alerts.push({
      id: `positive-cash-flow-${currencyCode}`,
      currencyCode,
      severity: "success",
      title: `${currencyCode} cash flow is positive`,
      message: `Income exceeds expenses for ${periodLabel}.`,
      metricKey: "netMinor",
      actionTarget: "dashboard",
      actionLabel: null,
    });
  }

  if (budget.over > 0) {
    alerts.push({
      id: `budget-over-${currencyCode}`,
      currencyCode,
      severity: "critical",
      title: `${currencyCode} budget exceeded`,
      message: `${budget.over} ${budget.over === 1 ? "budget is" : "budgets are"} over the limit.`,
      metricKey: "budget.over",
      actionTarget: "budgets",
      actionLabel: "Review budgets",
    });
  } else if (budget.atRisk > 0) {
    alerts.push({
      id: `budget-risk-${currencyCode}`,
      currencyCode,
      severity: "warning",
      title: `${currencyCode} budget pressure`,
      message: `${budget.atRisk} ${budget.atRisk === 1 ? "budget is" : "budgets are"} approaching the limit.`,
      metricKey: "budget.atRisk",
      actionTarget: "budgets",
      actionLabel: "Review budgets",
    });
  }

  return alerts;
}

function buildCurrencyRecommendations(
  currencyCode: string,
  entry: CurrencyReconciliationEntry,
  budget: CurrencyBudgetIntelligence
): IntelligenceRecommendation[] {
  const recommendations: IntelligenceRecommendation[] = [];

  if (entry.netMinor < 0) {
    recommendations.push({
      id: `improve-cash-flow-${currencyCode}`,
      currencyCode,
      priority: "high",
      title: `Improve ${currencyCode} cash flow`,
      rationale: "Expenses exceeded income in the selected period.",
      actionTarget: "transactions",
      actionLabel: "Review expenses",
    });
  }

  if (budget.over > 0 || budget.atRisk > 0) {
    recommendations.push({
      id: `review-budgets-${currencyCode}`,
      currencyCode,
      priority: budget.over > 0 ? "urgent" : "medium",
      title: `Review ${currencyCode} budgets`,
      rationale:
        budget.over > 0
          ? "One or more budgets have exceeded their limits."
          : "One or more budgets are approaching their limits.",
      actionTarget: "budgets",
      actionLabel: "Open budgets",
    });
  }

  if (recommendations.length === 0 && entry.transactionCount > 0) {
    recommendations.push({
      id: `maintain-position-${currencyCode}`,
      currencyCode,
      priority: "low",
      title: `Maintain the ${currencyCode} position`,
      rationale: "No immediate cash-flow or budget pressure was detected.",
      actionTarget: "dashboard",
      actionLabel: null,
    });
  }

  return recommendations;
}

/**
 * Builds the canonical, generic multi-currency intelligence model from the
 * certified reconciliation layers. React components should consume this model
 * rather than re-deriving financial conclusions independently.
 */
export function buildDashboardInsightModel({
  reconciliationEntries,
  budgetReconciliation,
  forecastReconciliation,
  filters,
  sourceCounts,
  resolveTransactionPresentation,
  generatedAt = new Date(),
  warnings = [],
}: BuildDashboardInsightModelInput): DashboardInsightModel {
  const currencyCodes = normalizeCurrencyCodes([
    ...reconciliationEntries.map((entry) => entry.currencyCode),
    ...forecastReconciliation.entries.map((entry) => entry.currencyCode),
    ...Object.keys(budgetReconciliation.statsByCurrency),
  ]);
  const reconciliationByCurrency = new Map(
    reconciliationEntries.map((entry) => [
      normalizeCurrencyCode(entry.currencyCode),
      entry,
    ])
  );

  const currencies = currencyCodes.map<CurrencyInsight>((currencyCode) => {
    const entry = reconciliationByCurrency.get(currencyCode) ?? {
      currencyCode,
      balanceMinor: 0,
      incomeMinor: 0,
      expenseMinor: 0,
      netMinor: 0,
      transactionCount: 0,
      largestIncome: null,
      largestExpense: null,
      budgetStats: { total: 0, onTrack: 0, atRisk: 0, over: 0 },
      health: {
        score: 0,
        label: "No activity",
        riskLevel: "Watch" as const,
        budgetPressureCount: 0,
      },
    };
    const budget = buildBudgetIntelligence(
      currencyCode,
      budgetReconciliation
    );
    const forecast = buildForecastIntelligence(
      currencyCode,
      forecastReconciliation
    );
    const health: CurrencyHealthIntelligence = {
      score: entry.health.score,
      label: entry.health.label,
      riskLevel: toRiskLevel(entry.health.riskLevel),
      budgetPressureCount: entry.health.budgetPressureCount,
      hasActivity:
        entry.transactionCount > 0 ||
        entry.balanceMinor !== 0 ||
        budget.total > 0,
    };
    const alerts = buildCurrencyAlerts(
      currencyCode,
      entry,
      budget,
      filters.period.label
    );
    const recommendations = buildCurrencyRecommendations(
      currencyCode,
      entry,
      budget
    );

    return {
      currencyCode,
      balanceMinor: entry.balanceMinor,
      incomeMinor: entry.incomeMinor,
      expenseMinor: entry.expenseMinor,
      netMinor: entry.netMinor,
      transactionCount: entry.transactionCount,
      largestIncome: toTransactionSummary(
        entry.largestIncome,
        currencyCode,
        resolveTransactionPresentation
      ),
      largestExpense: toTransactionSummary(
        entry.largestExpense,
        currencyCode,
        resolveTransactionPresentation
      ),
      incomeTrend: createEmptyTrend(),
      expenseTrend: createEmptyTrend(),
      budget,
      forecast,
      health,
      alerts,
      recommendations,
    };
  });

  const healthRanked = currencies
    .filter((currency) => currency.health.hasActivity)
    .slice()
    .sort((a, b) => a.health.score - b.health.score);
  const globalAlerts = currencies.flatMap((currency) => currency.alerts);
  const globalRecommendations = currencies.flatMap(
    (currency) => currency.recommendations
  );

  if (budgetReconciliation.unscoredBudgets > 0) {
    globalAlerts.push({
      id: "unscored-budget-currency",
      currencyCode: "GLOBAL",
      severity: "warning",
      title: "Budget currency needs clarification",
      message: `${budgetReconciliation.unscoredBudgets} ${
        budgetReconciliation.unscoredBudgets === 1 ? "budget was" : "budgets were"
      } excluded from utilization scoring because a currency could not be established safely.`,
      metricKey: "budget.unscored",
      actionTarget: "budgets",
      actionLabel: "Review budgets",
    });
  }

  if (forecastReconciliation.activeRuleCount > 0) {
    globalAlerts.push({
      id: "recurring-scheduled",
      currencyCode: "GLOBAL",
      severity: "info",
      title: "Recurring activity ahead",
      message: `${forecastReconciliation.activeRuleCount} active recurring ${
        forecastReconciliation.activeRuleCount === 1 ? "rule is" : "rules are"
      } included in the month-end forecast.`,
      metricKey: "forecast.activeRuleCount",
      actionTarget: "recurring",
      actionLabel: "Review recurring rules",
    });
  }

  const draftModel: DashboardInsightModel = {
    metadata: {
      generatedAt: generatedAt.toISOString(),
      modelVersion: DASHBOARD_INTELLIGENCE_MODEL_VERSION,
      sourceTransactionCount: sourceCounts.transactions,
      sourceWalletCount: sourceCounts.wallets,
      sourceBudgetCount: sourceCounts.budgets,
      sourceRecurringRuleCount: sourceCounts.recurringRules,
      isComplete: false,
      warnings: [],
    },
    filters,
    currencies,
    activeCurrencyCodes: currencies
      .filter((currency) => currency.health.hasActivity)
      .map((currency) => currency.currencyCode),
    weakestCurrencyCode: healthRanked[0]?.currencyCode ?? null,
    strongestCurrencyCode:
      healthRanked.length > 0
        ? healthRanked[healthRanked.length - 1]?.currencyCode ?? null
        : null,
    alerts: globalAlerts,
    recommendations: globalRecommendations,
  };

  const certification = certifyDashboardInsightModel(draftModel);
  const allWarnings = [...warnings, ...certification.warnings];

  return {
    ...draftModel,
    metadata: {
      ...draftModel.metadata,
      isComplete: certification.errors.length === 0 && allWarnings.length === 0,
      warnings: [...allWarnings, ...certification.errors],
    },
  };
}
