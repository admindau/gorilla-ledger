export type MonthlyReviewTransaction = {
  type: "income" | "expense";
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

export type MonthlyReviewCurrency = {
  currencyCode: string;
  current: {
    incomeMinor: number;
    expenseMinor: number;
    netMinor: number;
    transactionCount: number;
  };
  previous: {
    incomeMinor: number;
    expenseMinor: number;
    netMinor: number;
    transactionCount: number;
  };
  expenseChangePercent: number | null;
  incomeChangePercent: number | null;
  netChangeMinor: number;
  expenseTrend: "up" | "down" | "flat" | "new" | "no-baseline";
};

export type MonthlyReviewAction = {
  id: "record-activity" | "review-cash-flow" | "create-budget" | "inspect-spending" | "keep-building";
  label: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: "neutral" | "watch" | "positive";
};

export type MonthlyReviewModel = {
  selectedLabel: string;
  previousLabel: string;
  entries: MonthlyReviewCurrency[];
  currentTransactionCount: number;
  previousTransactionCount: number;
  hasCurrentActivity: boolean;
  hasPreviousActivity: boolean;
  primaryAction: MonthlyReviewAction;
};

type MonthlyReviewInput = {
  transactions: MonthlyReviewTransaction[];
  selectedYear: number;
  selectedMonth0: number;
  currentBudgetCount: number;
};

type MonthBucket = {
  incomeMinor: number;
  expenseMinor: number;
  transactionCount: number;
};

function normalizeCurrencyCode(value: string) {
  return value.trim().toUpperCase();
}

function monthLabel(year: number, month0: number) {
  return new Date(year, month0, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  const rawChange = ((current - previous) / previous) * 100;
  return Math.sign(rawChange) * Math.round(Math.abs(rawChange));
}

function expenseTrend(current: number, previous: number): MonthlyReviewCurrency["expenseTrend"] {
  if (previous === 0) return current > 0 ? "new" : "no-baseline";
  const change = percentageChange(current, previous) ?? 0;
  if (Math.abs(change) < 5) return "flat";
  return change > 0 ? "up" : "down";
}

function dateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getUTCFullYear(), month0: date.getUTCMonth() };
}

export function buildMonthlyReview({
  transactions,
  selectedYear,
  selectedMonth0,
  currentBudgetCount,
}: MonthlyReviewInput): MonthlyReviewModel {
  const previousDate = new Date(selectedYear, selectedMonth0 - 1, 1);
  const previousYear = previousDate.getFullYear();
  const previousMonth0 = previousDate.getMonth();
  const currentBuckets = new Map<string, MonthBucket>();
  const previousBuckets = new Map<string, MonthBucket>();

  for (const transaction of transactions) {
    if (!Number.isSafeInteger(transaction.amount_minor) || transaction.amount_minor < 0) continue;
    const currencyCode = normalizeCurrencyCode(transaction.currency_code);
    const parts = dateParts(transaction.occurred_at);
    if (!currencyCode || !parts) continue;

    const isCurrent = parts.year === selectedYear && parts.month0 === selectedMonth0;
    const isPrevious = parts.year === previousYear && parts.month0 === previousMonth0;
    if (!isCurrent && !isPrevious) continue;

    const target = isCurrent ? currentBuckets : previousBuckets;
    const bucket = target.get(currencyCode) ?? {
      incomeMinor: 0,
      expenseMinor: 0,
      transactionCount: 0,
    };
    if (transaction.type === "income") bucket.incomeMinor += transaction.amount_minor;
    if (transaction.type === "expense") bucket.expenseMinor += transaction.amount_minor;
    bucket.transactionCount += 1;
    target.set(currencyCode, bucket);
  }

  const currencies = Array.from(
    new Set([...currentBuckets.keys(), ...previousBuckets.keys()])
  ).sort();

  const entries = currencies.map<MonthlyReviewCurrency>((currencyCode) => {
    const currentBucket = currentBuckets.get(currencyCode) ?? {
      incomeMinor: 0,
      expenseMinor: 0,
      transactionCount: 0,
    };
    const previousBucket = previousBuckets.get(currencyCode) ?? {
      incomeMinor: 0,
      expenseMinor: 0,
      transactionCount: 0,
    };
    const currentNetMinor = currentBucket.incomeMinor - currentBucket.expenseMinor;
    const previousNetMinor = previousBucket.incomeMinor - previousBucket.expenseMinor;

    return {
      currencyCode,
      current: { ...currentBucket, netMinor: currentNetMinor },
      previous: { ...previousBucket, netMinor: previousNetMinor },
      expenseChangePercent: percentageChange(currentBucket.expenseMinor, previousBucket.expenseMinor),
      incomeChangePercent: percentageChange(currentBucket.incomeMinor, previousBucket.incomeMinor),
      netChangeMinor: currentNetMinor - previousNetMinor,
      expenseTrend: expenseTrend(currentBucket.expenseMinor, previousBucket.expenseMinor),
    };
  });

  const currentTransactionCount = entries.reduce(
    (sum, entry) => sum + entry.current.transactionCount,
    0
  );
  const previousTransactionCount = entries.reduce(
    (sum, entry) => sum + entry.previous.transactionCount,
    0
  );
  const negativeFlow = entries.some((entry) => entry.current.netMinor < 0);
  const spendingPressure = entries.some(
    (entry) => entry.expenseChangePercent !== null && entry.expenseChangePercent >= 20
  );

  let primaryAction: MonthlyReviewAction;
  if (currentTransactionCount === 0) {
    primaryAction = {
      id: "record-activity",
      label: "Build this month’s picture",
      description: "No activity is recorded for the selected month yet.",
      href: "/transactions",
      actionLabel: "Record activity",
      tone: "neutral",
    };
  } else if (negativeFlow) {
    primaryAction = {
      id: "review-cash-flow",
      label: "Review negative cash flow",
      description: "At least one currency ended the selected month with expenses above income.",
      href: "/transactions",
      actionLabel: "Review transactions",
      tone: "watch",
    };
  } else if (Math.max(0, Math.floor(currentBudgetCount)) === 0) {
    primaryAction = {
      id: "create-budget",
      label: "Turn insight into a guardrail",
      description: "Create a budget for the selected month to monitor spending pressure.",
      href: "/budgets",
      actionLabel: "Create budget",
      tone: "neutral",
    };
  } else if (spendingPressure) {
    primaryAction = {
      id: "inspect-spending",
      label: "Inspect the spending increase",
      description: "Expenses increased by at least 20% in one or more currencies.",
      href: "/transactions",
      actionLabel: "Inspect activity",
      tone: "watch",
    };
  } else {
    primaryAction = {
      id: "keep-building",
      label: "Monthly review is on track",
      description: "Keep recording activity to strengthen future comparisons and forecasts.",
      href: "/transactions",
      actionLabel: "View activity",
      tone: "positive",
    };
  }

  return {
    selectedLabel: monthLabel(selectedYear, selectedMonth0),
    previousLabel: monthLabel(previousYear, previousMonth0),
    entries,
    currentTransactionCount,
    previousTransactionCount,
    hasCurrentActivity: currentTransactionCount > 0,
    hasPreviousActivity: previousTransactionCount > 0,
    primaryAction,
  };
}

function decimalAmount(minor: number) {
  return (minor / 100).toFixed(2);
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildMonthlyReviewCsv(model: MonthlyReviewModel): string {
  const headers = [
    "Selected Month",
    "Previous Month",
    "Currency",
    "Current Income",
    "Current Expenses",
    "Current Net",
    "Previous Income",
    "Previous Expenses",
    "Previous Net",
    "Net Change",
    "Expense Change Percent",
  ];
  const rows = model.entries.map((entry) => [
    model.selectedLabel,
    model.previousLabel,
    entry.currencyCode,
    decimalAmount(entry.current.incomeMinor),
    decimalAmount(entry.current.expenseMinor),
    decimalAmount(entry.current.netMinor),
    decimalAmount(entry.previous.incomeMinor),
    decimalAmount(entry.previous.expenseMinor),
    decimalAmount(entry.previous.netMinor),
    decimalAmount(entry.netChangeMinor),
    entry.expenseChangePercent ?? "No baseline",
  ]);

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}
