"use client";

import React from "react";

type Budget = {
  id: string;
  amount_minor: number;
};

type Wallet = {
  id: string;
  name: string;
  currency_code: string;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

type BudgetSummary = {
  budget: Budget;
  wallet: Wallet | null;
  category?: Category;
  actualMinor: number;
  remainingMinor: number;
  usedRatio: number;
};

type Insight = {
  sortValue: number;
  text: string;
};

type BudgetInsightsPanelProps = {
  summaries: BudgetSummary[];
  monthLabel: string;
  riskThreshold: number;
};

function formatMinorToMajor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

export default function BudgetInsightsPanel({
  summaries,
  monthLabel,
  riskThreshold,
}: BudgetInsightsPanelProps) {
  if (!summaries || summaries.length === 0) {
    return null;
  }

  const insights: Insight[] = [];

  let overCount = 0;
  let riskCount = 0;
  let underUsedCount = 0;

  for (const s of summaries) {
    const { budget, wallet, category, actualMinor, usedRatio } = s;

    if (!budget || budget.amount_minor <= 0) continue;

    const currency = wallet?.currency_code ?? "";
    const name = category?.name ?? "Unknown category";
    const percentUsed = Math.round(usedRatio * 100);
    const actualMajor = formatMinorToMajor(actualMinor);
    const budgetMajor = formatMinorToMajor(budget.amount_minor);

    // Over budget
    if (usedRatio > 1) {
      overCount++;
      const text = `You are over budget in ${name}: ${percentUsed}% used (${actualMajor} ${currency} of ${budgetMajor} ${currency}). Consider reducing spending or increasing this budget next month.`;
      insights.push({
        sortValue: percentUsed,
        text,
      });
      continue;
    }

    // At risk
    if (usedRatio > riskThreshold && usedRatio <= 1) {
      riskCount++;
      const text = `${name} budget is at risk: ${percentUsed}% used (${actualMajor} ${currency} of ${budgetMajor} ${currency}). If you keep this pace, you may exceed the budget before ${monthLabel} ends.`;
      insights.push({
        sortValue: percentUsed,
        text,
      });
      continue;
    }

    // Under-used (opportunity)
    if (usedRatio > 0 && usedRatio < 0.4) {
      underUsedCount++;
      const text = `${name} budget is lightly used so far: ${percentUsed}% (${actualMajor} ${currency} of ${budgetMajor} ${currency}). You could safely reduce this budget next month or redirect funds to higher-pressure categories.`;
      insights.push({
        sortValue: percentUsed,
        text,
      });
      continue;
    }
  }

  // Global summary bullets
  if (overCount > 0) {
    insights.unshift({
      sortValue: 9999,
      text: `You have ${overCount} budget${
        overCount === 1 ? "" : "s"
      } over the limit this month.`,
    });
  }
  if (riskCount > 0) {
    insights.unshift({
      sortValue: 9998,
      text: `${riskCount} budget${
        riskCount === 1 ? " is" : "s are"
      } approaching the limit (${Math.round(riskThreshold * 100)}%+ used).`,
    });
  }
  if (underUsedCount > 0) {
    insights.push({
      sortValue: 1,
      text: `${underUsedCount} budget${
        underUsedCount === 1 ? " is" : "s are"
      } lightly used, offering room to reallocate or save.`,
    });
  }

  // Sort biggest pressure first, cap length
  insights.sort((a, b) => b.sortValue - a.sortValue);
  const topInsights = insights.slice(0, 6);

  if (topInsights.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <div className="border border-gray-800 rounded p-4 bg-black/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold">
            Budget Insights – {monthLabel}
          </h2>
          <p className="text-[11px] text-gray-400">
            Reading your budgets and actuals for this month to highlight risk,
            pressure, and opportunities.
          </p>
        </div>

        <ul className="text-xs text-gray-200 space-y-1.5 list-disc list-inside">
          {topInsights.map((insight, idx) => (
            <li key={idx}>{insight.text}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
