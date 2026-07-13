"use client";

import React from "react";

import { isInternalTransfer } from "@/lib/transactions/classification";

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


function isSameMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === month;
}

function formatMinorToMajor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

type InsightKind =
  | "increase"
  | "decrease"
  | "new"
  | "stopped"
  | "total_new"
  | "total_zero"
  | "total_increase"
  | "total_decrease";

type Insight = {
  sortValue: number;
  text: string;
  kind: InsightKind;
  currency?: string | null;
  categoryName?: string | null;
};

type ChangeStat = {
  pctChange: number;
  diffMinor: number;
  label: string;
  currency?: string | null;
};

export default function SmartInsightsPanel({
  transactions,
  categories,
  selectedYear,
  selectedMonth,
  walletFilter,
  categoryFilter,
}: SmartInsightsPanelProps) {
  const [showAll, setShowAll] = React.useState(false);

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
    if (isInternalTransfer(tx, category)) continue;

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
      insights.push({
        sortValue: currMinor,
        text,
        kind: "new",
        currency,
        categoryName: name,
      });
      newCategoryCount += 1;
      continue;
    }

    // No spending this month (100% down)
    if (prevMinor > 0 && currMinor === 0) {
      const prevMajor = formatMinorToMajor(prevMinor);
      const text = `No spending in ${name} this month; it is down 100% vs last month (${prevMajor} ${currency} → 0.00 ${currency}).`;
      insights.push({
        sortValue: prevMinor,
        text,
        kind: "stopped",
        currency,
        categoryName: name,
      });
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

      insights.push({
        sortValue: Math.abs(diff),
        text,
        kind: direction === "up" ? "increase" : "decrease",
        currency,
        categoryName: name,
      });

      const stat: ChangeStat = {
        pctChange,
        diffMinor: Math.abs(diff),
        label: `${name} in ${currency}`,
        currency,
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
      insights.push({
        sortValue: currMinor * 2,
        text,
        kind: "total_new",
        currency,
      });
      continue;
    }

    // No expenses this month
    if (prevMinor > 0 && currMinor === 0) {
      const prevMajor = formatMinorToMajor(prevMinor);
      const text = `Overall expenses in ${currency} dropped to 0.00 from ${prevMajor} ${currency} (-100% vs last month).`;
      insights.push({
        sortValue: prevMinor * 2,
        text,
        kind: "total_zero",
        currency,
      });

      const stat: ChangeStat = {
        pctChange: -100,
        diffMinor: prevMinor,
        label: `overall expenses in ${currency}`,
        currency,
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

      insights.push({
        sortValue: Math.abs(diff) * 2,
        text,
        kind: direction === "up" ? "total_increase" : "total_decrease",
        currency,
      });

      const stat: ChangeStat = {
        pctChange,
        diffMinor: Math.abs(diff),
        label: `overall expenses in ${currency}`,
        currency,
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

  // Sort biggest changes first (no limit – full list)
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

  // --- "What to pay attention to" box ---
  const attentionItems: string[] = [];

  if (biggestTotalIncrease && biggestTotalIncrease.pctChange > 0) {
    const pct = Math.round(Math.abs(biggestTotalIncrease.pctChange));
    attentionItems.push(
      `Biggest spike: ${biggestTotalIncrease.label} (up ${pct}%).`
    );
  } else if (biggestCategoryIncrease && biggestCategoryIncrease.pctChange > 0) {
    const pct = Math.round(Math.abs(biggestCategoryIncrease.pctChange));
    attentionItems.push(
      `Biggest spike: ${biggestCategoryIncrease.label} (up ${pct}%).`
    );
  }

  if (biggestTotalDecrease && biggestTotalDecrease.pctChange < 0) {
    const pct = Math.round(Math.abs(biggestTotalDecrease.pctChange));
    attentionItems.push(
      `Biggest drop: ${biggestTotalDecrease.label} (down ${pct}%).`
    );
  } else if (
    biggestCategoryDecrease &&
    biggestCategoryDecrease.pctChange < 0
  ) {
    const pct = Math.round(Math.abs(biggestCategoryDecrease.pctChange));
    attentionItems.push(
      `Biggest drop: ${biggestCategoryDecrease.label} (down ${pct}%).`
    );
  }

  if (stoppedCategoryCount > 0) {
    attentionItems.push(
      `Frozen categories: spending dropped to zero in ${stoppedCategoryCount} categor${
        stoppedCategoryCount === 1 ? "y" : "ies"
      }.`
    );
  }

  // --- Suggested "next steps" based on patterns ---
  const suggestions: string[] = [];

  if (
    biggestTotalIncrease &&
    Math.abs(biggestTotalIncrease.pctChange) >= 30
  ) {
    suggestions.push(
      `Consider setting or tightening a budget for ${biggestTotalIncrease.label} next month.`
    );
  } else if (
    biggestCategoryIncrease &&
    Math.abs(biggestCategoryIncrease.pctChange) >= 30
  ) {
    suggestions.push(
      `Watch ${biggestCategoryIncrease.label}; it may need its own budget limit.`
    );
  }

  if (stoppedCategoryCount > 0) {
    suggestions.push(
      `Review categories where spending dropped to zero to confirm this is intentional and sustainable.`
    );
  }

  if (newCategoryCount > 0) {
    suggestions.push(
      `Track the new spending categories to see if they should be part of your recurring monthly plan.`
    );
  }

  const getTypeLabel = (kind: InsightKind): string => {
    switch (kind) {
      case "increase":
      case "total_increase":
        return "Increase";
      case "decrease":
      case "total_decrease":
        return "Decrease";
      case "new":
      case "total_new":
        return "New";
      case "stopped":
      case "total_zero":
        return "Dropped to zero";
      default:
        return "Change";
    }
  };


  const topInsight = insights[0] ?? null;
  const secondaryInsights = insights.slice(1, 4);

  const changeTone = (kind: InsightKind) => {
    if (kind === "increase" || kind === "total_increase") {
      return "border-white/20 bg-white/[0.075] text-white";
    }
    if (kind === "decrease" || kind === "total_decrease") {
      return "border-white/10 bg-white/[0.035] text-gray-300";
    }
    return "border-white/15 bg-white/[0.05] text-gray-200";
  };

  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
            Month-on-month analysis
          </span>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-white">
            Smart Insights
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-gray-400">
            {currentLabel} compared with {prevLabel}.
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-gray-400">
          {insights.length} signal{insights.length === 1 ? "" : "s"}
        </span>
      </div>

      {insights.length === 0 ? (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/15 p-6 text-center">
          <div>
            <div className="mx-auto h-8 w-8 rounded-full border border-white/10 bg-white/[0.035]" />
            <p className="mt-3 text-sm font-medium text-gray-300">
              Spending is stable
            </p>
            <p className="mt-1 max-w-xs text-[11px] leading-5 text-gray-500">
              No material month-on-month changes were detected with the current filters.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-gray-500">New</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{newCategoryCount}</p>
              <p className="text-[9px] text-gray-500">categories</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-gray-500">Stopped</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{stoppedCategoryCount}</p>
              <p className="text-[9px] text-gray-500">categories</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-gray-500">Material</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{insights.length}</p>
              <p className="text-[9px] text-gray-500">changes</p>
            </div>
          </div>

          {topInsight && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${changeTone(topInsight.kind)}`}>
                  {getTypeLabel(topInsight.kind)}
                </span>
                {topInsight.currency && (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-medium text-gray-400">
                    {topInsight.currency}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold leading-5 text-white">
                {topInsight.text}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                Highest-impact movement
              </p>
            </div>
          )}

          {secondaryInsights.length > 0 && (
            <div className="mt-3 space-y-2">
              {secondaryInsights.map((insight, index) => (
                <div
                  key={`${insight.kind}-${insight.categoryName ?? "total"}-${index}`}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 text-[9px] font-semibold text-gray-400">
                    {index + 2}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-5 text-gray-300">{insight.text}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="text-[9px] uppercase tracking-[0.12em] text-gray-500">
                        {getTypeLabel(insight.kind)}
                      </span>
                      {insight.categoryName && (
                        <span className="text-[9px] text-gray-600">• {insight.categoryName}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(attentionItems.length > 0 || suggestions.length > 0) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {attentionItems[0] && (
                <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-gray-500">
                    Watch
                  </p>
                  <p className="mt-1.5 text-[10px] leading-4 text-gray-300">
                    {attentionItems[0]}
                  </p>
                </div>
              )}
              {suggestions[0] && (
                <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-gray-500">
                    Next action
                  </p>
                  <p className="mt-1.5 text-[10px] leading-4 text-gray-300">
                    {suggestions[0]}
                  </p>
                </div>
              )}
            </div>
          )}

          {insights.length > 4 && (
            <button
              type="button"
              className="mt-auto pt-4 text-left text-[10px] font-medium text-gray-500 transition hover:text-gray-300"
              onClick={() => setShowAll((prev) => !prev)}
              aria-expanded={showAll}
            >
              {showAll ? "Hide detailed signals" : `Review ${insights.length - 4} additional signal${insights.length - 4 === 1 ? "" : "s"}`}
            </button>
          )}

          {showAll && insights.length > 4 && (
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto border-t border-white/[0.07] pt-3 pr-1">
              {insights.slice(4).map((insight, index) => (
                <div key={`${insight.kind}-${index}`} className="flex gap-2 text-[10px] leading-4 text-gray-400">
                  <span className="text-gray-600">{index + 5}.</span>
                  <span>{insight.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
