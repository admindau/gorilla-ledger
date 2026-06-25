"use client";

import type { BudgetSummary } from "@/components/budgets/BudgetCommandCenter";

type BudgetInsightsProps = {
  summaries: BudgetSummary[];
};

function formatMinor(minor: number): string {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function labelFor(summary?: BudgetSummary): string {
  if (!summary) return "—";
  return summary.category?.name ?? "Unknown category";
}

function valueFor(summary?: BudgetSummary, selector?: (summary: BudgetSummary) => number): string {
  if (!summary || !selector) return "No data yet";
  const currency = summary.wallet?.currency_code ?? "";
  return `${formatMinor(selector(summary))}${currency ? ` ${currency}` : ""}`;
}

export function BudgetInsights({ summaries }: BudgetInsightsProps) {
  const largest = summaries.slice().sort((a, b) => b.amountMinor - a.amountMinor)[0];
  const mostSpent = summaries.slice().sort((a, b) => b.actualMinor - a.actualMinor)[0];
  const mostAtRisk = summaries.slice().sort((a, b) => b.usedRatio - a.usedRatio)[0];
  const bestControlled = summaries
    .filter((summary) => summary.actualMinor > 0)
    .slice()
    .sort((a, b) => a.usedRatio - b.usedRatio)[0];

  const items = [
    {
      label: "Largest Allocation",
      title: labelFor(largest),
      caption: valueFor(largest, (summary) => summary.amountMinor),
    },
    {
      label: "Most Spent",
      title: labelFor(mostSpent),
      caption: valueFor(mostSpent, (summary) => summary.actualMinor),
    },
    {
      label: "Most At Risk",
      title: labelFor(mostAtRisk),
      caption: mostAtRisk ? `${Math.round(mostAtRisk.usedRatio * 100)}% used` : "No data yet",
    },
    {
      label: "Best Controlled",
      title: labelFor(bestControlled),
      caption: bestControlled ? `${Math.round(bestControlled.usedRatio * 100)}% used` : "No spend recorded",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="gl-inner-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{item.label}</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{item.title}</p>
          <p className="mt-1 text-xs text-gray-500">{item.caption}</p>
        </div>
      ))}
    </section>
  );
}
