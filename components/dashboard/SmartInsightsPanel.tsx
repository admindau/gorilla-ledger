"use client";

import React from "react";

type TransactionType = "income" | "expense";

type Transaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

type SmartInsightsPanelProps = {
  transactions: Transaction[];
  categories: Category[];
  selectedYear: number;
  selectedMonth: number; // 0-based
  walletFilter: string; // "all" or wallet id
  categoryFilter: string; // "all" or category id
};

function isInternalTransferCategory(category?: Category | null): boolean {
  if (!category) return false;
  const n = category.name.toLowerCase().trim();
  return n.startsWith("transfer");
}

function isSameMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === month;
}

function formatMinorToMajor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

type Insight = {
  sortValue: number;
  text: string;
};

export default function SmartInsightsPanel({
  transactions,
  categories,
  selectedYear,
  selectedMonth,
  walletFilter,
  categoryFilter,
}: SmartInsightsPanelProps) {
  const categoryMap: Record<string, Category> = React.useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c] as const)),
    [categories]
  );

  // Determine previous month/year
  let prevYear = selectedYear;
  let prevMonth = selectedMonth - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = selectedYear - 1;
  }

  // Spending by category+currency for current and previous month
  const currentSpending: Record<string, number> = {};
  const previousSpending: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (!tx.category_id) continue;

    if (walletFilter !== "all" && tx.wallet_id !== walletFilter) continue;
    if (categoryFilter !== "all" && tx.category_id !== categoryFilter) {
      continue;
    }

    const category = categoryMap[tx.category_id];
    if (isInternalTransferCategory(category)) continue;

    const key = `${tx.category_id}|${tx.currency_code}`;

    if (isSameMonth(tx.occurred_at, selectedYear, selectedMonth)) {
      currentSpending[key] = (currentSpending[key] ?? 0) + tx.amount_minor;
    } else if (isSameMonth(tx.occurred_at, prevYear, prevMonth)) {
      previousSpending[key] = (previousSpending[key] ?? 0) + tx.amount_minor;
    }
  }

  const allKeys = new Set([
    ...Object.keys(currentSpending),
    ...Object.keys(previousSpending),
  ]);

  const insights: Insight[] = [];

  for (const key of allKeys) {
    const [categoryId, currency] = key.split("|");
    const category = categoryMap[categoryId];

    const name = category ? category.name : "Uncategorized";
    const currMinor = currentSpending[key] ?? 0;
    const prevMinor = previousSpending[key] ?? 0;

    if (currMinor === 0 && prevMinor === 0) continue;

    // New spending this month
    if (prevMinor === 0 && currMinor > 0) {
      const currMajor = formatMinorToMajor(currMinor);
      const text = `New spending in ${name} this month: ${currMajor} ${currency} (was 0.00 last month).`;
      insights.push({ sortValue: currMinor, text });
      continue;
    }

    // No spending this month
    if (prevMinor > 0 && currMinor === 0) {
      const prevMajor = formatMinorToMajor(prevMinor);
      const text = `No spending in ${name} this month; last month you spent ${prevMajor} ${currency}.`;
      insights.push({ sortValue: prevMinor, text });
      continue;
    }

    // Both months have spending – compare
    if (prevMinor > 0 && currMinor > 0) {
      const diff = currMinor - prevMinor;
      const pctChange = (diff / prevMinor) * 100;

      // Ignore small noise (< 10%)
      if (Math.abs(pctChange) < 10) continue;

      const direction = diff > 0 ? "up" : "down";
      const pctRounded = Math.round(Math.abs(pctChange));
      const currMajor = formatMinorToMajor(currMinor);
      const prevMajor = formatMinorToMajor(prevMinor);

      const text = `${name} spending is ${direction} ${pctRounded}% vs last month (${currMajor} ${currency} vs ${prevMajor} ${currency}).`;

      insights.push({ sortValue: Math.abs(diff), text });
    }
  }

  // Sort biggest changes first, limit how many we show
  insights.sort((a, b) => b.sortValue - a.sortValue);
  const topInsights = insights.slice(0, 5);

  const currentLabel = new Date(
    selectedYear,
    selectedMonth,
    1
  ).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  const prevLabel = new Date(prevYear, prevMonth, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="mb-6">
      <div className="border border-gray-800 rounded p-4 bg-black/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold">
            Smart Insights – {currentLabel}
          </h2>
          <p className="text-[11px] text-gray-400">
            Comparing this month&apos;s spending to {prevLabel} using your
            current wallet &amp; category filters.
          </p>
        </div>

        {topInsights.length === 0 ? (
          <p className="text-xs text-gray-500">
            No major changes vs last month with the current filters.
          </p>
        ) : (
          <ul className="text-xs text-gray-200 space-y-1.5 list-disc list-inside">
            {topInsights.map((insight, idx) => (
              <li key={idx}>{insight.text}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
