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

type ChangeStat = {
  pctChange: number;
  diffMinor: number;
  label: string;
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

  // Totals per currency for current and previous month
  const currentTotals: Record<string, number> = {};
  const previousTotals: Record<string, number> = {};

  // Counters / trackers for summary
  let newCategoryCount = 0;
  let stoppedCategoryCount = 0;

  let biggestCategoryIncrease: ChangeStat | null = null;
  let biggestCategoryDecrease: ChangeStat | null = null;
  let biggestTotalIncrease: ChangeStat | null = null;
  let biggestTotalDecrease: ChangeStat | null = null;

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (!tx.category_id) continue;

    if (walletFilter !== "all" && tx.wallet_id !== walletFilter) continue;
    if (categoryFilter !== "all" && tx.category_id !== categoryFilter) {
      continue;
    }

    const category = categoryMap[tx.category_id];
    if (isInternalTransferCategory(category)) continue;

    const inCurrent = isSameMonth(tx.occurred_at, selectedYear, selectedMonth);
    const inPrevious = isSameMonth(tx.occurred_at, prevYear, prevMonth);

    if (!inCurrent && !inPrevious) continue;

    const key = `${tx.category_id}|${tx.currency_code}`;

    if (inCurrent) {
      currentSpending[key] = (currentSpending[key] ?? 0) + tx.amount_minor;
      currentTotals[tx.currency_code] =
        (currentTotals[tx.currency_code] ?? 0) + tx.amount_minor;
    }

    if (inPrevious) {
      previousSpending[key] = (previousSpending[key] ?? 0) + tx.amount_minor;
      previousTotals[tx.currency_code] =
        (previousTotals[tx.currency_code] ?? 0) + tx.amount_minor;
    }
  }

  const allCatKeys = new Set([
    ...Object.keys(currentSpending),
    ...Object.keys(previousSpending),
  ]);

  const insights: Insight[] = [];

  // --- Category-level insights ---
  for (const key of allCatKeys) {
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
      newCategoryCount += 1;
      continue;
    }

    // No spending this month (100% down)
    if (prevMinor > 0 && currMinor === 0) {
      const prevMajor = formatMinorToMajor(prevMinor);
      const text = `No spending in ${name} this month; it is down 100% vs last month (${prevMajor} ${currency} → 0.00 ${currency}).`;
      insights.push({ sortValue: prevMinor, text });
      stoppedCategoryCount += 1;
      continue;
    }

    // Both months have spending – compare with % change
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

      const stat: ChangeStat = {
        pctChange,
        diffMinor: Math.abs(diff),
        label: `${name} in ${currency}`,
      };

      if (pctChange > 0) {
        if (
          !biggestCategoryIncrease ||
          Math.abs(pctChange) > Math.abs(biggestCategoryIncrease.pctChange)
        ) {
          biggestCategoryIncrease = stat;
        }
      } else if (pctChange < 0) {
        if (
          !biggestCategoryDecrease ||
          Math.abs(pctChange) > Math.abs(biggestCategoryDecrease.pctChange)
        ) {
          biggestCategoryDecrease = stat;
        }
      }
    }
  }

  // --- Overall totals per currency ---
  const allCurrencyCodes = new Set([
    ...Object.keys(currentTotals),
    ...Object.keys(previousTotals),
  ]);

  for (const currency of allCurrencyCodes) {
    const currMinor = currentTotals[currency] ?? 0;
    const prevMinor = previousTotals[currency] ?? 0;

    if (currMinor === 0 && prevMinor === 0) continue;

    // New total spending this month
    if (prevMinor === 0 && currMinor > 0) {
      const currMajor = formatMinorToMajor(currMinor);
      const text = `Overall expenses in ${currency} are new this month: ${currMajor} ${currency} (0.00 last month).`;
      insights.push({ sortValue: currMinor * 2, text });
      continue;
    }

    // No expenses this month
    if (prevMinor > 0 && currMinor === 0) {
      const prevMajor = formatMinorToMajor(prevMinor);
      const text = `Overall expenses in ${currency} dropped to 0.00 from ${prevMajor} ${currency} (-100% vs last month).`;
      insights.push({ sortValue: prevMinor * 2, text });

      const stat: ChangeStat = {
        pctChange: -100,
        diffMinor: prevMinor,
        label: `overall expenses in ${currency}`,
      };

      if (
        !biggestTotalDecrease ||
        Math.abs(stat.pctChange) > Math.abs(biggestTotalDecrease.pctChange)
      ) {
        biggestTotalDecrease = stat;
      }

      continue;
    }

    if (prevMinor > 0 && currMinor > 0) {
      const diff = currMinor - prevMinor;
      const pctChange = (diff / prevMinor) * 100;

      if (Math.abs(pctChange) < 5) continue; // more sensitive for totals

      const direction = diff > 0 ? "up" : "down";
      const pctRounded = Math.round(Math.abs(pctChange));
      const currMajor = formatMinorToMajor(currMinor);
      const prevMajor = formatMinorToMajor(prevMinor);

      const text = `Overall expenses in ${currency} are ${direction} ${pctRounded}% vs last month (${currMajor} ${currency} vs ${prevMajor} ${currency}).`;

      // Multiply sortValue so totals tend to appear higher in the list
      insights.push({ sortValue: Math.abs(diff) * 2, text });

      const stat: ChangeStat = {
        pctChange,
        diffMinor: Math.abs(diff),
        label: `overall expenses in ${currency}`,
      };

      if (pctChange > 0) {
        if (
          !biggestTotalIncrease ||
          Math.abs(pctChange) > Math.abs(biggestTotalIncrease.pctChange)
        ) {
          biggestTotalIncrease = stat;
        }
      } else if (pctChange < 0) {
        if (
          !biggestTotalDecrease ||
          Math.abs(pctChange) > Math.abs(biggestTotalDecrease.pctChange)
        ) {
          biggestTotalDecrease = stat;
        }
      }
    }
  }

  // Sort biggest changes first (no limit – show full list)
  insights.sort((a, b) => b.sortValue - a.sortValue);

  const currentLabel = new Date(selectedYear, selectedMonth, 1).toLocaleString(
    "en",
    {
      month: "long",
      year: "numeric",
    }
  );

  const prevLabel = new Date(prevYear, prevMonth, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  // Build a compact summary sentence for the top of the panel
  let summaryParts: string[] = [];

  if (biggestTotalIncrease && biggestTotalIncrease.pctChange > 0) {
    const pct = Math.round(Math.abs(biggestTotalIncrease.pctChange));
    summaryParts.push(
      `${biggestTotalIncrease.label} is up ${pct}% vs last month.`
    );
  }

  if (biggestTotalDecrease && biggestTotalDecrease.pctChange < 0) {
    const pct = Math.round(Math.abs(biggestTotalDecrease.pctChange));
    summaryParts.push(
      `${biggestTotalDecrease.label} is down ${pct}% vs last month.`
    );
  }

  if (!biggestTotalIncrease && biggestCategoryIncrease) {
    const pct = Math.round(Math.abs(biggestCategoryIncrease.pctChange));
    summaryParts.push(
      `${biggestCategoryIncrease.label} is up ${pct}% vs last month.`
    );
  }

  if (!biggestTotalDecrease && biggestCategoryDecrease) {
    const pct = Math.round(Math.abs(biggestCategoryDecrease.pctChange));
    summaryParts.push(
      `${biggestCategoryDecrease.label} is down ${pct}% vs last month.`
    );
  }

  if (newCategoryCount > 0 || stoppedCategoryCount > 0) {
    const bits: string[] = [];
    if (newCategoryCount > 0) {
      bits.push(
        `new spending appeared in ${newCategoryCount} categor${
          newCategoryCount === 1 ? "y" : "ies"
        }`
      );
    }
    if (stoppedCategoryCount > 0) {
      bits.push(
        `spending dropped to zero in ${stoppedCategoryCount} categor${
          stoppedCategoryCount === 1 ? "y" : "ies"
        }`
      );
    }
    summaryParts.push(bits.join("; ") + ".");
  }

  const summaryText =
    summaryParts.length > 0 ? summaryParts.join(" ") : null;

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

        {summaryText && (
          <div className="mb-2 text-[11px] text-gray-300">
            {summaryText}
          </div>
        )}

        {insights.length === 0 ? (
          <p className="text-xs text-gray-500">
            No major changes vs last month with the current filters.
          </p>
        ) : (
          <ul className="text-xs text-gray-200 space-y-1.5 list-disc list-inside">
            {insights.map((insight, idx) => (
              <li key={idx}>{insight.text}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
