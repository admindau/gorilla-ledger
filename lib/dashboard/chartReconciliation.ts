import { isInternalTransfer } from "@/lib/transactions/classification";

export type DashboardChartTransaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

export type DashboardChartCategory = {
  id: string;
  name: string;
  type: "income" | "expense";
};

export type DailyIncomeExpensePoint = {
  day: string;
  income: number;
  expense: number;
  currencyCode: string;
};

export type ChartFilterContract = {
  walletFilter: string;
  categoryFilter: string;
  yearFilter?: string;
};

export function getCalendarDateParts(value: string): {
  date: Date;
  year: number;
  monthIndex: number;
  day: number;
  dayKey: string;
} | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = date.getDate();

  return {
    date,
    year,
    monthIndex,
    day,
    dayKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`,
  };
}

export function isInCalendarMonth(
  occurredAt: string,
  year: number,
  monthIndex: number
): boolean {
  const parts = getCalendarDateParts(occurredAt);
  return Boolean(
    parts && parts.year === year && parts.monthIndex === monthIndex
  );
}

export function isInCalendarYear(
  occurredAt: string,
  year: number
): boolean {
  const parts = getCalendarDateParts(occurredAt);
  return Boolean(parts && parts.year === year);
}

function transactionMatchesFilters(
  transaction: DashboardChartTransaction,
  categoryMap: Record<string, DashboardChartCategory>,
  filters: ChartFilterContract
): boolean {
  if (
    filters.walletFilter !== "all" &&
    transaction.wallet_id !== filters.walletFilter
  ) {
    return false;
  }

  if (
    filters.categoryFilter !== "all" &&
    transaction.category_id !== filters.categoryFilter
  ) {
    return false;
  }

  if (filters.yearFilter && filters.yearFilter !== "all") {
    const targetYear = Number(filters.yearFilter);
    if (!Number.isFinite(targetYear)) return false;
    if (!isInCalendarYear(transaction.occurred_at, targetYear)) return false;
  }

  const category = transaction.category_id
    ? categoryMap[transaction.category_id] ?? null
    : null;

  return !isInternalTransfer(transaction, category);
}

export function buildDailyIncomeExpenseSeries(
  transactions: DashboardChartTransaction[],
  categoryMap: Record<string, DashboardChartCategory>,
  filters: ChartFilterContract
): DailyIncomeExpensePoint[] {
  const buckets = new Map<string, DailyIncomeExpensePoint>();

  for (const transaction of transactions) {
    if (!transactionMatchesFilters(transaction, categoryMap, filters)) {
      continue;
    }

    const parts = getCalendarDateParts(transaction.occurred_at);
    if (!parts) continue;

    const currencyCode = transaction.currency_code.trim().toUpperCase();
    if (!currencyCode) continue;

    const key = `${parts.dayKey}|${currencyCode}`;
    const row = buckets.get(key) ?? {
      day: parts.dayKey,
      income: 0,
      expense: 0,
      currencyCode,
    };

    const amount = transaction.amount_minor / 100;
    if (transaction.type === "income") row.income += amount;
    if (transaction.type === "expense") row.expense += amount;

    buckets.set(key, row);
  }

  return Array.from(buckets.values()).sort((a, b) => {
    const dayOrder = a.day.localeCompare(b.day);
    return dayOrder !== 0
      ? dayOrder
      : a.currencyCode.localeCompare(b.currencyCode);
  });
}

export function buildDensifiedMonthSeries(
  transactions: DashboardChartTransaction[],
  categoryMap: Record<string, DashboardChartCategory>,
  filters: ChartFilterContract,
  selectedYear: number,
  selectedMonth: number
): DailyIncomeExpensePoint[] {
  const monthTransactions = transactions.filter((transaction) => {
    if (
      !isInCalendarMonth(
        transaction.occurred_at,
        selectedYear,
        selectedMonth
      )
    ) {
      return false;
    }

    return transactionMatchesFilters(transaction, categoryMap, {
      ...filters,
      yearFilter: "all",
    });
  });

  const currencies = Array.from(
    new Set(
      monthTransactions
        .map((transaction) =>
          transaction.currency_code.trim().toUpperCase()
        )
        .filter(Boolean)
    )
  ).sort();

  if (currencies.length === 0) return [];

  const numberOfDays = new Date(
    selectedYear,
    selectedMonth + 1,
    0
  ).getDate();
  const buckets = new Map<string, DailyIncomeExpensePoint>();

  for (const currencyCode of currencies) {
    for (let day = 1; day <= numberOfDays; day += 1) {
      const dayKey = `${selectedYear}-${String(selectedMonth + 1).padStart(
        2,
        "0"
      )}-${String(day).padStart(2, "0")}`;
      buckets.set(`${dayKey}|${currencyCode}`, {
        day: dayKey,
        income: 0,
        expense: 0,
        currencyCode,
      });
    }
  }

  for (const transaction of monthTransactions) {
    const parts = getCalendarDateParts(transaction.occurred_at);
    if (!parts) continue;

    const currencyCode = transaction.currency_code.trim().toUpperCase();
    const row = buckets.get(`${parts.dayKey}|${currencyCode}`);
    if (!row) continue;

    const amount = transaction.amount_minor / 100;
    if (transaction.type === "income") row.income += amount;
    if (transaction.type === "expense") row.expense += amount;
  }

  return Array.from(buckets.values()).sort((a, b) => {
    const dayOrder = a.day.localeCompare(b.day);
    return dayOrder !== 0
      ? dayOrder
      : a.currencyCode.localeCompare(b.currencyCode);
  });
}

export function takeTrailingTwelveMonths(
  series: DailyIncomeExpensePoint[],
  referenceDate = new Date()
): DailyIncomeExpensePoint[] {
  const cutoff = new Date(
    referenceDate.getFullYear() - 1,
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  cutoff.setHours(0, 0, 0, 0);

  return series.filter((row) => {
    const [year, month, day] = row.day.split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) return false;
    return new Date(year, month - 1, day) >= cutoff;
  });
}
