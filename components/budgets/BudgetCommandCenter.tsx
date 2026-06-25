"use client";

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
  wallet?: Wallet | null;
  category?: Category | null;
};

type BudgetCommandCenterProps = {
  summaries: BudgetSummary[];
  monthLabel: string;
};

function formatMinor(minor: number): string {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function primaryCurrency(summaries: BudgetSummary[]): string {
  return summaries.find((summary) => summary.wallet?.currency_code)?.wallet?.currency_code ?? "SSP";
}

function sumForCurrency(
  summaries: BudgetSummary[],
  selector: (summary: BudgetSummary) => number,
  currency: string
): number {
  return summaries
    .filter((summary) => (summary.wallet?.currency_code ?? currency) === currency)
    .reduce((sum, summary) => sum + selector(summary), 0);
}

function healthLabel(score: number | null): string {
  if (score === null) return "No budgets";
  if (score >= 85) return "Healthy";
  if (score >= 65) return "Watchlist";
  return "At risk";
}

export function BudgetCommandCenter({ summaries, monthLabel }: BudgetCommandCenterProps) {
  const totalBudgets = summaries.length;
  const overBudget = summaries.filter((summary) => summary.usedRatio > 1).length;
  const atRisk = summaries.filter((summary) => summary.usedRatio >= 0.8 && summary.usedRatio <= 1).length;
  const healthy = summaries.filter((summary) => summary.usedRatio < 0.8).length;

  const score =
    totalBudgets === 0
      ? null
      : Math.max(0, Math.round(100 - (overBudget / totalBudgets) * 45 - (atRisk / totalBudgets) * 20));

  const currency = primaryCurrency(summaries);
  const allocatedMinor = sumForCurrency(summaries, (summary) => summary.amountMinor, currency);
  const remainingMinor = sumForCurrency(
    summaries,
    (summary) => Math.max(0, summary.remainingMinor),
    currency
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
      value: `${formatMinor(remainingMinor)} ${currency}`,
      caption: `${formatMinor(allocatedMinor)} ${currency} allocated`,
      tone: remainingMinor > 0 ? "positive" : "",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="gl-premium-card p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{item.label}</p>
          <p
            className={[
              "mt-2 truncate text-2xl font-semibold tracking-tight",
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
