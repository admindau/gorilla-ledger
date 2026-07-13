export type TransactionKind = "income" | "expense";

export type ReconciliationTransaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: TransactionKind;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

export type BudgetCurrencyStats = {
  total: number;
  onTrack: number;
  atRisk: number;
  over: number;
};

export type CurrencyReconciliationEntry = {
  currencyCode: string;
  balanceMinor: number;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  transactionCount: number;
  largestIncome: ReconciliationTransaction | null;
  largestExpense: ReconciliationTransaction | null;
  budgetStats: BudgetCurrencyStats;
  health: {
    score: number;
    label: string;
    riskLevel: "Healthy" | "Watch" | "Warning" | "Critical";
    budgetPressureCount: number;
  };
};

type ReconciliationInput = {
  totalsByCurrency: Record<string, number>;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
  monthTransactions: ReconciliationTransaction[];
  budgetStatsByCurrency: Record<string, BudgetCurrencyStats>;
};

const EMPTY_BUDGET_STATS: BudgetCurrencyStats = {
  total: 0,
  onTrack: 0,
  atRisk: 0,
  over: 0,
};

function calculateHealth(
  balanceMinor: number,
  incomeMinor: number,
  expenseMinor: number,
  transactionCount: number,
  budgetStats: BudgetCurrencyStats
): CurrencyReconciliationEntry["health"] {
  const netMinor = incomeMinor - expenseMinor;
  const budgetComplianceRatio =
    budgetStats.total === 0
      ? 1
      : budgetStats.onTrack / Math.max(budgetStats.total, 1);

  const activityScore = transactionCount > 0 ? 15 : 5;
  const cashFlowScore =
    incomeMinor === 0 && expenseMinor === 0
      ? 10
      : netMinor >= 0
      ? 35
      : incomeMinor > 0
      ? Math.max(5, Math.round(35 * (incomeMinor / Math.max(expenseMinor, 1))))
      : 5;
  const budgetScore =
    budgetStats.total === 0
      ? 18
      : Math.round(30 * budgetComplianceRatio) - budgetStats.over * 4;
  const balanceScore = balanceMinor >= 0 ? 20 : 8;

  const score = Math.max(
    0,
    Math.min(
      100,
      cashFlowScore + Math.max(0, budgetScore) + activityScore + balanceScore
    )
  );

  const label =
    score >= 85
      ? "Excellent"
      : score >= 70
      ? "Good"
      : score >= 50
      ? "Watch"
      : "Needs attention";

  const riskLevel: CurrencyReconciliationEntry["health"]["riskLevel"] =
    score < 45 || budgetStats.over > 0
      ? "Critical"
      : score < 65 || budgetStats.atRisk > 0
      ? "Warning"
      : score < 80
      ? "Watch"
      : "Healthy";

  return {
    score,
    label,
    riskLevel,
    budgetPressureCount: budgetStats.atRisk + budgetStats.over,
  };
}

/**
 * Produces the single authoritative currency ledger used by executive KPIs,
 * largest-transaction signals, alerts, and financial-health scoring.
 *
 * Currency values are never combined or compared across currencies.
 */
export function buildDashboardReconciliation({
  totalsByCurrency,
  incomeByCurrency,
  expenseByCurrency,
  monthTransactions,
  budgetStatsByCurrency,
}: ReconciliationInput): CurrencyReconciliationEntry[] {
  const currencies = Array.from(
    new Set([
      ...Object.keys(totalsByCurrency),
      ...Object.keys(incomeByCurrency),
      ...Object.keys(expenseByCurrency),
      ...Object.keys(budgetStatsByCurrency),
      ...monthTransactions.map((transaction) => transaction.currency_code),
    ])
  ).sort();

  return currencies.map((currencyCode) => {
    const currencyTransactions = monthTransactions.filter(
      (transaction) => transaction.currency_code === currencyCode
    );
    const largestIncome =
      currencyTransactions
        .filter((transaction) => transaction.type === "income")
        .sort((a, b) => b.amount_minor - a.amount_minor)[0] ?? null;
    const largestExpense =
      currencyTransactions
        .filter((transaction) => transaction.type === "expense")
        .sort((a, b) => b.amount_minor - a.amount_minor)[0] ?? null;

    const balanceMinor = totalsByCurrency[currencyCode] ?? 0;
    const incomeMinor = incomeByCurrency[currencyCode] ?? 0;
    const expenseMinor = expenseByCurrency[currencyCode] ?? 0;
    const budgetStats = budgetStatsByCurrency[currencyCode] ?? EMPTY_BUDGET_STATS;

    return {
      currencyCode,
      balanceMinor,
      incomeMinor,
      expenseMinor,
      netMinor: incomeMinor - expenseMinor,
      transactionCount: currencyTransactions.length,
      largestIncome,
      largestExpense,
      budgetStats,
      health: calculateHealth(
        balanceMinor,
        incomeMinor,
        expenseMinor,
        currencyTransactions.length,
        budgetStats
      ),
    };
  });
}

export function reconciliationMoneyEntries(
  entries: CurrencyReconciliationEntry[],
  field: "balanceMinor" | "incomeMinor" | "expenseMinor" | "netMinor"
): Array<readonly [string, number]> {
  return entries.map(
    (entry) => [entry.currencyCode, entry[field]] as const
  );
}
