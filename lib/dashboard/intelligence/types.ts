/**
 * Shared contracts for Gorilla Ledger's dashboard intelligence layer.
 *
 * Currency codes are treated as data. No business logic in this module assumes
 * a fixed set of currencies or converts between currencies.
 */

export type CurrencyCode = string;

export type TransactionDirection = "income" | "expense";

export type IntelligenceRiskLevel =
  | "healthy"
  | "watch"
  | "warning"
  | "critical";

export type IntelligenceSeverity = "info" | "success" | "warning" | "critical";

export type IntelligenceTrendDirection = "up" | "down" | "flat" | "unavailable";

export type IntelligenceRecommendationPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent";

export type IntelligenceActionTarget =
  | "dashboard"
  | "wallets"
  | "transactions"
  | "budgets"
  | "recurring"
  | "categories"
  | "settings"
  | "none";

export type IntelligencePeriod = {
  start: string;
  end: string;
  label: string;
  year: number;
  month0: number;
};

export type IntelligenceFilters = {
  walletId: string | null;
  categoryId: string | null;
  currencyCode: CurrencyCode | null;
  period: IntelligencePeriod;
};

export type IntelligenceTransactionSummary = {
  id: string;
  walletId: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  direction: TransactionDirection;
  amountMinor: number;
  currencyCode: CurrencyCode;
  occurredAt: string;
};

export type IntelligenceBudgetStatus =
  | "healthy"
  | "atRisk"
  | "over"
  | "unscored";

export type CurrencyBudgetIntelligence = {
  total: number;
  scored: number;
  unscored: number;
  healthy: number;
  atRisk: number;
  over: number;
  allocatedMinor: number;
  actualMinor: number;
  remainingMinor: number;
  utilizationRatio: number | null;
  status: IntelligenceBudgetStatus;
};

export type CurrencyForecastIntelligence = {
  availability: "available" | "historical-unavailable" | "unavailable";
  currentBalanceMinor: number;
  scheduledIncomeMinor: number;
  scheduledExpenseMinor: number;
  projectedBalanceMinor: number;
  scheduledOccurrencesCount: number;
  scheduledRuleCount: number;
  windowStart: string | null;
  windowEnd: string | null;
};

export type CurrencyHealthIntelligence = {
  score: number;
  label: string;
  riskLevel: IntelligenceRiskLevel;
  budgetPressureCount: number;
  hasActivity: boolean;
};

export type CurrencyTrendIntelligence = {
  direction: IntelligenceTrendDirection;
  currentMinor: number;
  previousMinor: number;
  absoluteChangeMinor: number;
  percentageChange: number | null;
};

export type IntelligenceAlert = {
  id: string;
  currencyCode: CurrencyCode;
  severity: IntelligenceSeverity;
  title: string;
  message: string;
  metricKey: string;
  actionTarget: IntelligenceActionTarget;
  actionLabel: string | null;
};

export type IntelligenceRecommendation = {
  id: string;
  currencyCode: CurrencyCode;
  priority: IntelligenceRecommendationPriority;
  title: string;
  rationale: string;
  actionTarget: IntelligenceActionTarget;
  actionLabel: string | null;
};

export type CurrencyInsight = {
  currencyCode: CurrencyCode;
  balanceMinor: number;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  transactionCount: number;
  largestIncome: IntelligenceTransactionSummary | null;
  largestExpense: IntelligenceTransactionSummary | null;
  incomeTrend: CurrencyTrendIntelligence;
  expenseTrend: CurrencyTrendIntelligence;
  budget: CurrencyBudgetIntelligence;
  forecast: CurrencyForecastIntelligence;
  health: CurrencyHealthIntelligence;
  alerts: IntelligenceAlert[];
  recommendations: IntelligenceRecommendation[];
};

export type DashboardIntelligenceMetadata = {
  generatedAt: string;
  modelVersion: string;
  sourceTransactionCount: number;
  sourceWalletCount: number;
  sourceBudgetCount: number;
  sourceRecurringRuleCount: number;
  isComplete: boolean;
  warnings: string[];
};

export type DashboardInsightModel = {
  metadata: DashboardIntelligenceMetadata;
  filters: IntelligenceFilters;
  currencies: CurrencyInsight[];
  activeCurrencyCodes: CurrencyCode[];
  weakestCurrencyCode: CurrencyCode | null;
  strongestCurrencyCode: CurrencyCode | null;
  alerts: IntelligenceAlert[];
  recommendations: IntelligenceRecommendation[];
};

export type CurrencyInsightMap = Record<CurrencyCode, CurrencyInsight>;

export type DashboardIntelligenceSourceCounts = {
  transactions: number;
  wallets: number;
  budgets: number;
  recurringRules: number;
};
