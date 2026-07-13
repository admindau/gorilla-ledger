"use client";

import Link from "next/link";
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

type AiInsightsSidebarProps = {
  transactions: Transaction[];
  categories: Category[];
  selectedYear: number;
  selectedMonth: number;
  walletFilter: string;
  categoryFilter: string;
};

type MonthAgg = {
  totalByCurrency: Record<string, number>;
  categoriesActive: Set<string>;
};

type CoachTone = "positive" | "attention" | "neutral";


function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString("en", {
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amountMinor: number, currency: string): string {
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amountMinor / 100)} ${currency}`;
}

function toneClasses(tone: CoachTone): string {
  if (tone === "positive") {
    return "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200";
  }
  if (tone === "attention") {
    return "border-amber-500/20 bg-amber-500/[0.06] text-amber-100";
  }
  return "border-white/10 bg-white/[0.035] text-gray-200";
}

function SignalIcon({ tone }: { tone: CoachTone }) {
  const path =
    tone === "positive"
      ? "M5 12.5l4 4L19 6.5"
      : tone === "attention"
        ? "M12 8v5m0 3.5h.01"
        : "M12 8v4m0 4h.01";

  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${toneClasses(tone)}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
        {tone !== "positive" ? <circle cx="12" cy="12" r="9" /> : null}
      </svg>
    </span>
  );
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
    () => Object.fromEntries(categories.map((category) => [category.id, category] as const)),
    [categories]
  );

  const analysis = React.useMemo(() => {
    const selectedDate = new Date(selectedYear, selectedMonth, 1);
    const months = Array.from({ length: 3 }, (_, offset) => {
      const date = new Date(selectedDate);
      date.setMonth(selectedDate.getMonth() - offset);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

    const monthKeys = new Set(months.map(({ year, month }) => toMonthKey(year, month)));
    const monthAgg: Record<string, MonthAgg> = {};

    for (const transaction of transactions) {
      if (transaction.type !== "expense" || !transaction.category_id) continue;
      if (walletFilter !== "all" && transaction.wallet_id !== walletFilter) continue;
      if (categoryFilter !== "all" && transaction.category_id !== categoryFilter) continue;

      const category = categoryMap[transaction.category_id];
      if (isInternalTransfer(transaction, category)) continue;

      const occurredAt = new Date(transaction.occurred_at);
      if (Number.isNaN(occurredAt.getTime())) continue;

      const key = toMonthKey(occurredAt.getFullYear(), occurredAt.getMonth());
      if (!monthKeys.has(key)) continue;

      monthAgg[key] ??= { totalByCurrency: {}, categoriesActive: new Set<string>() };
      const bucket = monthAgg[key];
      bucket.totalByCurrency[transaction.currency_code] =
        (bucket.totalByCurrency[transaction.currency_code] ?? 0) + transaction.amount_minor;
      bucket.categoriesActive.add(transaction.category_id);
    }

    const currentKey = toMonthKey(selectedYear, selectedMonth);
    const previousKeys = months.slice(1).map(({ year, month }) => toMonthKey(year, month));
    const currentAgg = monthAgg[currentKey];
    const previousAggs = previousKeys.map((key) => monthAgg[key]).filter(Boolean) as MonthAgg[];
    const currentTotals = currentAgg?.totalByCurrency ?? {};

    let primaryCurrency: string | null = null;
    let highestCurrentAmount = -1;
    for (const [currency, amount] of Object.entries(currentTotals)) {
      if (amount > highestCurrentAmount) {
        primaryCurrency = currency;
        highestCurrentAmount = amount;
      }
    }

    if (!primaryCurrency) {
      for (const aggregate of previousAggs) {
        const firstCurrency = Object.keys(aggregate.totalByCurrency)[0];
        if (firstCurrency) {
          primaryCurrency = firstCurrency;
          break;
        }
      }
    }

    const currentMinor = primaryCurrency ? currentTotals[primaryCurrency] ?? 0 : 0;
    const previousValues = primaryCurrency
      ? previousAggs.map((aggregate) => aggregate.totalByCurrency[primaryCurrency!] ?? 0)
      : [];
    const previousAverageMinor = previousValues.length
      ? previousValues.reduce((sum, value) => sum + value, 0) / previousValues.length
      : 0;

    const currentCategoryCount = currentAgg?.categoriesActive.size ?? 0;
    const previousCategoryCounts = previousAggs.map((aggregate) => aggregate.categoriesActive.size);
    const previousCategoryAverage = previousCategoryCounts.length
      ? previousCategoryCounts.reduce((sum, value) => sum + value, 0) / previousCategoryCounts.length
      : 0;

    const percentageChange = previousAverageMinor > 0
      ? ((currentMinor - previousAverageMinor) / previousAverageMinor) * 100
      : null;

    return {
      months,
      currentAgg,
      primaryCurrency,
      currentMinor,
      previousAverageMinor,
      currentCategoryCount,
      previousCategoryAverage,
      percentageChange,
    };
  }, [categoryFilter, categoryMap, selectedMonth, selectedYear, transactions, walletFilter]);

  const {
    months,
    currentAgg,
    primaryCurrency,
    currentMinor,
    previousAverageMinor,
    currentCategoryCount,
    previousCategoryAverage,
    percentageChange,
  } = analysis;

  const hasTrendData = Boolean(primaryCurrency) && (currentMinor > 0 || previousAverageMinor > 0);
  const trendTone: CoachTone =
    percentageChange === null || Math.abs(percentageChange) < 10
      ? "neutral"
      : percentageChange > 0
        ? "attention"
        : "positive";

  const trendLabel = !primaryCurrency
    ? "Not enough data"
    : currentMinor === 0 && previousAverageMinor > 0
      ? "No spending this month"
      : previousAverageMinor === 0 && currentMinor > 0
        ? "New spending activity"
        : percentageChange === null || Math.abs(percentageChange) < 10
          ? "Spending is stable"
          : percentageChange > 0
            ? `Spending is up ${Math.round(Math.abs(percentageChange))}%`
            : `Spending is down ${Math.round(Math.abs(percentageChange))}%`;

  const trendDetail = !primaryCurrency
    ? "Keep recording expenses to unlock a reliable month-on-month signal."
    : !hasTrendData
      ? `No ${primaryCurrency} expenses were recorded across the selected three-month window.`
      : `${formatMoney(currentMinor, primaryCurrency)} this month versus a recent monthly average of ${formatMoney(previousAverageMinor, primaryCurrency)}.`;

  const categoryDelta = currentCategoryCount - previousCategoryAverage;
  const habitsTone: CoachTone =
    !currentAgg || previousCategoryAverage === 0
      ? "neutral"
      : categoryDelta > 3
        ? "attention"
        : "positive";

  const habitsLabel = !currentAgg
    ? "No active categories"
    : `${currentCategoryCount} active categor${currentCategoryCount === 1 ? "y" : "ies"}`;

  const habitsDetail = previousCategoryAverage > 0
    ? `Recent months averaged about ${Math.round(previousCategoryAverage)} active categories.`
    : "More history is needed before category habits can be compared.";

  let recommendationTitle = "Keep tracking consistently";
  let recommendationBody = "A longer history will make future coaching more precise and actionable.";
  let recommendationTone: CoachTone = "neutral";
  let actionLabel = "Review transactions";
  let actionHref = "/transactions";

  if (percentageChange !== null && percentageChange > 25 && primaryCurrency) {
    recommendationTitle = "Review your spending limits";
    recommendationBody = `Spending is materially above the recent ${primaryCurrency} average. Confirm that the increase is intentional and adjust your budget where needed.`;
    recommendationTone = "attention";
    actionLabel = "Review budgets";
    actionHref = "/budgets";
  } else if (percentageChange !== null && percentageChange < -25 && primaryCurrency) {
    recommendationTitle = "Protect the savings gap";
    recommendationBody = `Your ${primaryCurrency} spending is materially lower. Consider assigning the difference to savings or another priority.`;
    recommendationTone = "positive";
    actionLabel = "Review wallets";
    actionHref = "/wallets";
  } else if (previousCategoryAverage > 0 && categoryDelta > 3) {
    recommendationTitle = "Consolidate scattered spending";
    recommendationBody = "You are using more categories than usual. Review small purchases and simplify where possible.";
    recommendationTone = "attention";
  } else if (currentAgg && previousCategoryAverage > 0 && categoryDelta < -3) {
    recommendationTitle = "Check deferred obligations";
    recommendationBody = "Fewer categories are active than usual. Confirm that important recurring expenses have not been postponed.";
    recommendationTone = "neutral";
    actionLabel = "Review recurring";
    actionHref = "/recurring";
  }

  const currentLabel = formatMonthLabel(selectedYear, selectedMonth);
  const comparisonLabels = months.slice(1).map(({ year, month }) => formatMonthLabel(year, month));

  return (
    <aside aria-labelledby="ai-coach-title" className="h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="gl-section-eyebrow">Decision support</span>
          <h2 id="ai-coach-title" className="mt-3 text-base font-semibold tracking-tight text-white">
            AI Coach
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-gray-400">
            {currentLabel} compared with {comparisonLabels.join(" and ")}.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">
          3-month view
        </span>
      </div>

      <div className="mt-5 space-y-2.5">
        <section className={`rounded-2xl border p-3.5 ${toneClasses(trendTone)}`}>
          <div className="flex items-start gap-3">
            <SignalIcon tone={trendTone} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-70">Spending signal</p>
              <p className="mt-1 text-sm font-semibold text-white">{trendLabel}</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-300">{trendDetail}</p>
            </div>
          </div>
        </section>

        <section className={`rounded-2xl border p-3.5 ${toneClasses(habitsTone)}`}>
          <div className="flex items-start gap-3">
            <SignalIcon tone={habitsTone} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-70">Habit signal</p>
              <p className="mt-1 text-sm font-semibold text-white">{habitsLabel}</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-300">{habitsDetail}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="flex items-start gap-3">
          <SignalIcon tone={recommendationTone} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">Recommended action</p>
            <h3 className="mt-1 text-sm font-semibold text-white">{recommendationTitle}</h3>
            <p className="mt-1.5 text-[11px] leading-5 text-gray-400">{recommendationBody}</p>
            <Link
              href={actionHref}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {actionLabel}
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10h12M11 5l5 5-5 5" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <details className="group mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-medium text-gray-400 marker:content-none">
          How this was calculated
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </summary>
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-5 text-gray-500">
          Gorilla Ledger compares expense activity for the selected month with the previous two months. Internal transfers are excluded, wallet and category filters are respected, and currencies are never combined or converted.
        </p>
      </details>
    </aside>
  );
}
