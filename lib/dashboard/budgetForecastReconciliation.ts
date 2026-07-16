import {
  buildRecurringForecast,
  type ForecastRecurringRule,
} from "@/lib/recurring/forecast";

export type BudgetReconciliationBudget = {
  id: string;
  wallet_id: string | null;
  category_id: string;
  year: number;
  month: number;
  amount_minor: number;
};

export type BudgetReconciliationWallet = {
  id: string;
  name: string;
  currency_code: string;
};

export type BudgetReconciliationCategory = {
  id: string;
  name: string;
  type: "income" | "expense";
};

export type BudgetReconciliationTransaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
  transaction_kind?: string | null;
  transfer_id?: string | null;
};

export type BudgetStatus = "healthy" | "atRisk" | "over" | "unscored";

export type ReconciledBudgetSummary = {
  budget: BudgetReconciliationBudget;
  wallet: BudgetReconciliationWallet | null;
  category: BudgetReconciliationCategory | null;
  currencyCode: string | null;
  isCurrencySafe: boolean;
  isScorable: boolean;
  scoringReason: string | null;
  actualMinor: number;
  remainingMinor: number;
  usedRatio: number;
  status: BudgetStatus;
};

export type BudgetCurrencyStats = {
  total: number;
  onTrack: number;
  atRisk: number;
  over: number;
};

export type BudgetReconciliationResult = {
  summaries: ReconciledBudgetSummary[];
  statsByCurrency: Record<string, BudgetCurrencyStats>;
  totalBudgets: number;
  scoredBudgets: number;
  unscoredBudgets: number;
  budgetsOnTrack: number;
  budgetsAtRisk: number;
  budgetsOver: number;
};

type BudgetReconciliationInput = {
  budgets: BudgetReconciliationBudget[];
  wallets: BudgetReconciliationWallet[];
  categories: BudgetReconciliationCategory[];
  transactions: BudgetReconciliationTransaction[];
  selectedYear: number;
  selectedMonth0: number;
  riskThreshold: number;
  isInternalTransfer: (
    transaction: BudgetReconciliationTransaction,
    category: BudgetReconciliationCategory | null
  ) => boolean;
};

function localMonthParts(value: string): { year: number; month0: number } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getUTCFullYear(), month0: date.getUTCMonth() };
}

function aggregateKey(
  walletId: string,
  categoryId: string,
  type: "income" | "expense",
  currencyCode: string
): string {
  return `${walletId}\u001f${categoryId}\u001f${type}\u001f${currencyCode}`;
}

/**
 * Builds one authoritative budget-vs-actual ledger for the selected month.
 * Walletless budgets remain visible but are deliberately unscored because the
 * current schema does not establish their currency.
 */
export function buildBudgetReconciliation({
  budgets,
  wallets,
  categories,
  transactions,
  selectedYear,
  selectedMonth0,
  riskThreshold,
  isInternalTransfer,
}: BudgetReconciliationInput): BudgetReconciliationResult {
  const walletMap = new Map(wallets.map((wallet) => [wallet.id, wallet]));
  const categoryMap = new Map(
    categories.map((category) => [category.id, category])
  );
  const actuals = new Map<string, number>();

  for (const transaction of transactions) {
    const parts = localMonthParts(transaction.occurred_at);
    if (
      !parts ||
      parts.year !== selectedYear ||
      parts.month0 !== selectedMonth0 ||
      !transaction.category_id
    ) {
      continue;
    }

    const category = categoryMap.get(transaction.category_id) ?? null;
    if (!category || isInternalTransfer(transaction, category)) continue;
    if (transaction.type !== category.type) continue;

    const key = aggregateKey(
      transaction.wallet_id,
      transaction.category_id,
      transaction.type,
      transaction.currency_code
    );
    actuals.set(key, (actuals.get(key) ?? 0) + transaction.amount_minor);
  }

  const summaries = budgets
    .filter(
      (budget) =>
        budget.year === selectedYear && budget.month === selectedMonth0 + 1
    )
    .map<ReconciledBudgetSummary>((budget) => {
      const wallet = budget.wallet_id
        ? walletMap.get(budget.wallet_id) ?? null
        : null;
      const category = categoryMap.get(budget.category_id) ?? null;
      const currencyCode = wallet?.currency_code ?? null;

      let scoringReason: string | null = null;
      if (!wallet) {
        scoringReason = budget.wallet_id
          ? "The assigned wallet could not be found."
          : "Assign this budget to a wallet to establish its currency.";
      } else if (!category) {
        scoringReason = "The assigned category could not be found.";
      } else if (budget.amount_minor <= 0) {
        scoringReason = "Set a budget amount greater than zero.";
      }

      const isScorable = scoringReason === null && Boolean(currencyCode);
      const actualMinor =
        isScorable && wallet && category && currencyCode
          ? actuals.get(
              aggregateKey(
                wallet.id,
                category.id,
                category.type,
                currencyCode
              )
            ) ?? 0
          : 0;
      const remainingMinor = budget.amount_minor - actualMinor;
      const usedRatio =
        isScorable && budget.amount_minor > 0
          ? actualMinor / budget.amount_minor
          : 0;
      const status: BudgetStatus = !isScorable
        ? "unscored"
        : usedRatio > 1
        ? "over"
        : usedRatio > riskThreshold
        ? "atRisk"
        : "healthy";

      return {
        budget,
        wallet,
        category,
        currencyCode,
        isCurrencySafe: isScorable,
        isScorable,
        scoringReason,
        actualMinor,
        remainingMinor,
        usedRatio,
        status,
      };
    });

  const statsByCurrency: Record<string, BudgetCurrencyStats> = {};
  for (const summary of summaries) {
    if (!summary.isScorable || !summary.currencyCode) continue;
    const stats = statsByCurrency[summary.currencyCode] ?? {
      total: 0,
      onTrack: 0,
      atRisk: 0,
      over: 0,
    };
    stats.total += 1;
    if (summary.status === "over") stats.over += 1;
    else if (summary.status === "atRisk") stats.atRisk += 1;
    else stats.onTrack += 1;
    statsByCurrency[summary.currencyCode] = stats;
  }

  const scoredBudgets = summaries.filter((summary) => summary.isScorable).length;
  const budgetsOnTrack = summaries.filter(
    (summary) => summary.status === "healthy"
  ).length;
  const budgetsAtRisk = summaries.filter(
    (summary) => summary.status === "atRisk"
  ).length;
  const budgetsOver = summaries.filter(
    (summary) => summary.status === "over"
  ).length;

  return {
    summaries,
    statsByCurrency,
    totalBudgets: summaries.length,
    scoredBudgets,
    unscoredBudgets: summaries.length - scoredBudgets,
    budgetsOnTrack,
    budgetsAtRisk,
    budgetsOver,
  };
}

export type ReconciledForecastEntry = {
  currencyCode: string;
  currentBalanceMinor: number;
  projectedBalanceMinor: number;
  scheduledIncomeMinor: number;
  scheduledExpenseMinor: number;
  scheduledOccurrencesCount: number;
  scheduledRuleCount: number;
};

export type ForecastAvailability = "available" | "historical-unavailable";

export type ForecastReconciliationResult = {
  entries: ReconciledForecastEntry[];
  totalOccurrences: number;
  activeRuleCount: number;
  availability: ForecastAvailability;
  windowStart: Date | null;
  windowEnd: Date;
};

type ForecastReconciliationInput = {
  totalsByCurrency: Record<string, number>;
  recurringRules: ForecastRecurringRule[];
  selectedYear: number;
  selectedMonth0: number;
  now?: Date;
};

/**
 * Reconciles current wallet balances with every recurring occurrence due up to
 * the selected month-end. Historical months are not projected from today's
 * balance because that would produce a misleading result without snapshots.
 */
export function buildMonthEndForecastReconciliation({
  totalsByCurrency,
  recurringRules,
  selectedYear,
  selectedMonth0,
  now = new Date(),
}: ForecastReconciliationInput): ForecastReconciliationResult {
  const windowEnd = new Date(
    selectedYear,
    selectedMonth0 + 1,
    0,
    23,
    59,
    59,
    999
  );

  if (windowEnd.getTime() < now.getTime()) {
    return {
      entries: [],
      totalOccurrences: 0,
      activeRuleCount: 0,
      availability: "historical-unavailable",
      windowStart: null,
      windowEnd,
    };
  }

  const forecast = buildRecurringForecast(recurringRules, now, windowEnd);
  const recurringByCurrency = new Map(
    forecast.entries.map((entry) => [entry.currencyCode, entry])
  );
  const currencies = Array.from(
    new Set([
      ...Object.keys(totalsByCurrency),
      ...forecast.entries.map((entry) => entry.currencyCode),
    ])
  ).sort();

  const entries = currencies.map<ReconciledForecastEntry>((currencyCode) => {
    const recurring = recurringByCurrency.get(currencyCode);
    const currentBalanceMinor = totalsByCurrency[currencyCode] ?? 0;
    const scheduledIncomeMinor = recurring?.scheduledIncomeMinor ?? 0;
    const scheduledExpenseMinor = recurring?.scheduledExpenseMinor ?? 0;

    return {
      currencyCode,
      currentBalanceMinor,
      projectedBalanceMinor:
        currentBalanceMinor + scheduledIncomeMinor - scheduledExpenseMinor,
      scheduledIncomeMinor,
      scheduledExpenseMinor,
      scheduledOccurrencesCount: recurring?.scheduledOccurrencesCount ?? 0,
      scheduledRuleCount: recurring?.scheduledRuleIds.length ?? 0,
    };
  });

  return {
    entries,
    totalOccurrences: forecast.totalOccurrences,
    activeRuleCount: forecast.activeRuleCount,
    availability: "available",
    windowStart: now,
    windowEnd,
  };
}
