"use client";

import { sumCurrencyAmounts } from "@/lib/finance/currencyTotals";
import { MetricGridState, type DataState } from "@/components/ui/MetricGridState";

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

export type BudgetSummary = {
  id: string;
  amountMinor: number;
  actualMinor: number;
  remainingMinor: number;
  usedRatio: number;
  currencyCode: string | null;
  wallet?: Wallet | null;
  category?: Category | null;
};

type BudgetCommandCenterProps = {
  summaries: BudgetSummary[];
  monthLabel: string;
  dataState?: DataState;
};

function formatMinor(minor: number): string {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function healthLabel(score: number | null): string {
  if (score === null) return "No budgets";
  if (score >= 85) return "Healthy";
  if (score >= 65) return "Watchlist";
  return "At risk";
}

function MoneyLines({ amounts }: { amounts: ReturnType<typeof sumCurrencyAmounts> }) {
  if (amounts.length === 0) return <span>—</span>;
  return (
    <span className="flex flex-col gap-1">
      {amounts.map(({ currencyCode, amountMinor }) => (
        <span key={currencyCode}>{formatMinor(amountMinor)} {currencyCode}</span>
      ))}
    </span>
  );
}

export function BudgetCommandCenter({
  summaries,
  monthLabel,
  dataState = "ready",
}: BudgetCommandCenterProps) {
  if (dataState !== "ready") return <MetricGridState state={dataState} />;

  const totalBudgets = summaries.length;
  const overBudget = summaries.filter((summary) => summary.usedRatio > 1).length;
  const atRisk = summaries.filter((summary) => summary.usedRatio >= 0.8 && summary.usedRatio <= 1).length;
  const healthy = summaries.filter((summary) => summary.usedRatio < 0.8).length;

  const score =
    totalBudgets === 0
      ? null
      : Math.max(0, Math.round(100 - (overBudget / totalBudgets) * 45 - (atRisk / totalBudgets) * 20));

  const assignedSummaries = summaries.filter(
    (summary): summary is BudgetSummary & { currencyCode: string } => Boolean(summary.currencyCode)
  );
  const allocated = sumCurrencyAmounts(
    assignedSummaries.map((summary) => ({
      currencyCode: summary.currencyCode,
      amountMinor: summary.amountMinor,
    }))
  );
  const remaining = sumCurrencyAmounts(
    assignedSummaries.map((summary) => ({
      currencyCode: summary.currencyCode,
      amountMinor: summary.remainingMinor,
    }))
  );

  const items = [
    {
      label: "Budget Health",
      value: score === null ? "—" : `${score}%`,
      caption: healthLabel(score),
      tone: score === null ? "" : score >= 85 ? "positive" : score >= 65 ? "warning" : "negative",
    },
    {
      label: "Active Budgets",
      value: String(totalBudgets),
      caption: monthLabel,
    },
    {
      label: "At Risk",
      value: String(atRisk + overBudget),
      caption: `${healthy} healthy`,
      tone: atRisk + overBudget > 0 ? "warning" : "positive",
    },
    {
      label: "Remaining",
      value: <MoneyLines amounts={remaining} />,
      caption: allocated.length > 1 ? "Separated by currency" : "Budget minus recorded spend",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="gl-premium-card p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{item.label}</p>
          <p
            className={[
              "mt-2 text-xl font-semibold tracking-tight",
              item.tone === "positive" ? "text-green-300" : "",
              item.tone === "warning" ? "text-yellow-200" : "",
              item.tone === "negative" ? "text-red-300" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.value}
          </p>
          <p className="mt-1 text-xs text-gray-500">{item.caption}</p>
        </div>
      ))}
    </section>
  );
}
