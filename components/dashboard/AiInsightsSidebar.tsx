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

type AiInsightsSidebarProps = {
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

function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function formatMonthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleString("en", { month: "short", year: "numeric" });
}

function formatMinorToMajor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

export default function AiInsightsSidebar({
  transactions,
  categories,
  selectedYear,
  selectedMonth,
  walletFilter,
  categoryFilter,
}: AiInsightsSidebarProps) {
  const categoryMap = React.useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c] as const)),
    [categories]
  );

  // Aggregate current + previous 2 months
  type MonthAgg = {
    totalByCurrency: Record<string, number>;
    categoriesActive: Set<string>;
  };

  const monthAgg: Record<string, MonthAgg> = {};

  function addToMonthAgg(
    year: number,
    month: number,
    currency: string,
    categoryId: string,
    amountMinor: number
  ) {
    const key = toMonthKey(year, month);
    if (!monthAgg[key]) {
      monthAgg[key] = {
        totalByCurrency: {},
        categoriesActive: new Set<string>(),
      };
    }
    const bucket = monthAgg[key];
    bucket.totalByCurrency[currency] =
      (bucket.totalByCurrency[currency] ?? 0) + amountMinor;
    bucket.categoriesActive.add(categoryId);
  }

  const now = new Date(selectedYear, selectedMonth, 1);
  const monthsToInclude: { year: number; month: number }[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(now);
    d.setMonth(now.getMonth() - offset);
    monthsToInclude.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  const monthKeySet = new Set(
    monthsToInclude.map((m) => toMonthKey(m.year, m.month))
  );

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (!tx.category_id) continue;

    if (walletFilter !== "all" && tx.wallet_id !== walletFilter) continue;
    if (categoryFilter !== "all" && tx.category_id !== categoryFilter) continue;

    const category = categoryMap[tx.category_id];
    if (isInternalTransferCategory(category)) continue;

    const d = new Date(tx.occurred_at);
    if (Number.isNaN(d.getTime())) continue;

    const key = toMonthKey(d.getFullYear(), d.getMonth());
    if (!monthKeySet.has(key)) continue;

    addToMonthAgg(
      d.getFullYear(),
      d.getMonth(),
      tx.currency_code,
      tx.category_id,
      tx.amount_minor
    );
  }

  const currentKey = toMonthKey(selectedYear, selectedMonth);
  const prev1 = new Date(selectedYear, selectedMonth - 1, 1);
  const prev2 = new Date(selectedYear, selectedMonth - 2, 1);
  const prev1Key = toMonthKey(prev1.getFullYear(), prev1.getMonth());
  const prev2Key = toMonthKey(prev2.getFullYear(), prev2.getMonth());

  const currentAgg = monthAgg[currentKey];
  const prevAggs = [monthAgg[prev1Key], monthAgg[prev2Key]].filter(
    Boolean
  ) as MonthAgg[];

  const currentTotals = currentAgg?.totalByCurrency ?? {};
  const prevTotals = prevAggs.map((m) => m.totalByCurrency);

  // Pick primary currency = highest current spending (fallback to previous)
  let primaryCurrency: string | null = null;
  let maxCurr = -1;

  for (const [ccy, amount] of Object.entries(currentTotals)) {
    if (amount > maxCurr) {
      maxCurr = amount;
      primaryCurrency = ccy;
    }
  }

  if (!primaryCurrency) {
    const seenPrev = new Set<string>();
    for (const totals of prevTotals) {
      for (const ccy of Object.keys(totals)) {
        seenPrev.add(ccy);
      }
    }
    primaryCurrency = seenPrev.values().next().value ?? null;
  }

  function sumForCurrency(
    totals: Record<string, number> | undefined,
    currency: string | null
  ): number {
    if (!totals || !currency) return 0;
    return totals[currency] ?? 0;
  }

  const currentPrimaryMinor = primaryCurrency
    ? sumForCurrency(currentTotals, primaryCurrency)
    : 0;

  const prevPrimaryMinorValues: number[] = [];
  if (primaryCurrency) {
    for (const totals of prevTotals) {
      prevPrimaryMinorValues.push(sumForCurrency(totals, primaryCurrency));
    }
  }

  const prevPrimaryAvgMinor =
    prevPrimaryMinorValues.length > 0
      ? prevPrimaryMinorValues.reduce((a, b) => a + b, 0) /
        prevPrimaryMinorValues.length
      : 0;

  // Trend summary
  let trendSummary: string | null = null;
  if (!primaryCurrency) {
    trendSummary = "Not enough expense data yet to analyse trends.";
  } else if (currentPrimaryMinor === 0 && prevPrimaryAvgMinor === 0) {
    trendSummary = `No recorded expenses in ${primaryCurrency} over the last three months.`;
  } else if (currentPrimaryMinor === 0 && prevPrimaryAvgMinor > 0) {
    const prevMajor = formatMinorToMajor(prevPrimaryAvgMinor);
    trendSummary = `Spending in ${primaryCurrency} is at 0.00 this month, compared to an average of ${prevMajor} ${primaryCurrency} in the previous months.`;
  } else if (prevPrimaryAvgMinor === 0 && currentPrimaryMinor > 0) {
    const currMajor = formatMinorToMajor(currentPrimaryMinor);
    trendSummary = `Spending in ${primaryCurrency} has appeared this month at ${currMajor} ${primaryCurrency}, after two very quiet months.`;
  } else if (prevPrimaryAvgMinor > 0) {
    const diff = currentPrimaryMinor - prevPrimaryAvgMinor;
    const pct = (diff / prevPrimaryAvgMinor) * 100;
    const pctRounded = Math.round(Math.abs(pct));
    const currMajor = formatMinorToMajor(currentPrimaryMinor);
    const avgMajor = formatMinorToMajor(prevPrimaryAvgMinor);

    if (Math.abs(pct) < 10) {
      trendSummary = `Spending in ${primaryCurrency} is broadly stable this month (${currMajor} vs a recent average of ${avgMajor} ${primaryCurrency}).`;
    } else if (pct > 0) {
      trendSummary = `Spending in ${primaryCurrency} is up about ${pctRounded}% this month (${currMajor} vs ${avgMajor} ${primaryCurrency} on average).`;
    } else {
      trendSummary = `Spending in ${primaryCurrency} is down about ${pctRounded}% this month (${currMajor} vs ${avgMajor} ${primaryCurrency} on average).`;
    }
  }

  // Habits: active categories
  function countActiveCategories(agg: MonthAgg | undefined): number {
    return agg ? agg.categoriesActive.size : 0;
  }

  const currentActiveCategories = countActiveCategories(currentAgg);
  const prevActiveCounts = prevAggs.map(countActiveCategories);
  const prevActiveAvg =
    prevActiveCounts.length > 0
      ? prevActiveCounts.reduce((a, b) => a + b, 0) /
        prevActiveCounts.length
      : 0;

  const habitsItems: string[] = [];

  if (currentAgg) {
    habitsItems.push(
      `You used ${currentActiveCategories} spending categor${
        currentActiveCategories === 1 ? "y" : "ies"
      } this month.`
    );
  }

  if (prevActiveAvg > 0) {
    const roundedAvg = Math.round(prevActiveAvg);
    habitsItems.push(
      `In recent months you averaged about ${roundedAvg} active categories.`
    );
  }

  if (!currentAgg && prevAggs.length > 0) {
    habitsItems.push(
      "This month shows no spending, which is unusual compared to previous months."
    );
  }

  // Coaching tips
  const tips: string[] = [];

  if (primaryCurrency && currentPrimaryMinor > 0 && prevPrimaryAvgMinor > 0) {
    const diff = currentPrimaryMinor - prevPrimaryAvgMinor;
    const pct = (diff / prevPrimaryAvgMinor) * 100;

    if (pct > 25) {
      tips.push(
        `Consider setting a tighter budget in ${primaryCurrency} if this higher level of spending is not intentional.`
      );
    } else if (pct < -25) {
      tips.push(
        `If the lower spending in ${primaryCurrency} is deliberate, think about whether you can redirect some of that freed-up cash towards savings or priority goals.`
      );
    }
  }

  if (currentActiveCategories > 0 && prevActiveAvg > 0) {
    if (currentActiveCategories > prevActiveAvg + 3) {
      tips.push(
        "You are using more categories than usual; this can be a sign that small, scattered purchases are creeping in. Consider simplifying or consolidating."
      );
    } else if (currentActiveCategories + 3 < prevActiveAvg) {
      tips.push(
        "You are spending in fewer categories than usual; this can be good if it reflects focus, but double-check that you are not postponing important recurring expenses."
      );
    }
  }

  if (tips.length === 0) {
    tips.push(
      "Keep tracking consistently for a few more months; patterns will become clearer and Gorilla Ledger will give sharper coaching tips."
    );
  }

  const currentLabel = formatMonthLabel(selectedYear, selectedMonth);
  const prevLabels = monthsToInclude
    .slice(1)
    .map((m) => formatMonthLabel(m.year, m.month));

  return (
    <aside className="border border-gray-800 rounded p-4 bg-black/60 mb-8">
      <h2 className="text-sm font-semibold mb-1">AI Insights Coach</h2>
      <p className="text-[11px] text-gray-400 mb-3">
        Looking at your spending over {currentLabel}
        {prevLabels.length > 0 ? ` vs ${prevLabels.join(" & ")}` : ""}.
      </p>

      <div className="mb-3">
        <h3 className="text-xs font-semibold text-gray-200 mb-1">
          Spending trend
        </h3>
        <p className="text-[11px] text-gray-300">
          {trendSummary ?? "Not enough data yet to describe a trend."}
        </p>
      </div>

      {habitsItems.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-semibold text-gray-200 mb-1">
            Habits snapshot
          </h3>
          <ul className="text-[11px] text-gray-300 space-y-0.5 list-disc list-inside">
            {habitsItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-gray-200 mb-1">
          Coaching tips
        </h3>
        <ul className="text-[11px] text-gray-300 space-y-0.5 list-disc list-inside">
          {tips.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
