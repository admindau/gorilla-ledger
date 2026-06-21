type BudgetHealthSummary = {
  budget: {
    id: string;
    amount_minor: number;
  };
  wallet?: {
    name: string;
    currency_code: string;
  } | null;
  category?: {
    name: string;
    type: "income" | "expense";
  } | null;
  actualMinor: number;
  remainingMinor: number;
  usedRatio: number;
};

type BudgetHealthWidgetProps = {
  summaries: BudgetHealthSummary[];
  totalBudgets: number;
  budgetsOnTrack: number;
  budgetsAtRisk: number;
  budgetsOver: number;
  riskThreshold: number;
  monthLabel: string;
};

function formatMinor(minor: number) {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusForRatio(ratio: number, riskThreshold: number) {
  if (ratio > 1) {
    return {
      label: "Over",
      className: "border-white/70 text-white",
      helper: "Budget exceeded",
    };
  }

  if (ratio > riskThreshold) {
    return {
      label: "At risk",
      className: "border-gray-500 text-gray-200",
      helper: "Approaching limit",
    };
  }

  return {
    label: "Healthy",
    className: "border-gray-700 text-gray-300",
    helper: "On track",
  };
}

export default function BudgetHealthWidget({
  summaries,
  totalBudgets,
  budgetsOnTrack,
  budgetsAtRisk,
  budgetsOver,
  riskThreshold,
  monthLabel,
}: BudgetHealthWidgetProps) {
  const highlighted = summaries
    .slice()
    .sort((a, b) => b.usedRatio - a.usedRatio)
    .slice(0, 4);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Budget Health</h3>
          <p className="mt-1 text-[11px] text-gray-400">
            Visual budget status for {monthLabel}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
          <span className="rounded-full border border-gray-800 px-2 py-1">
            {budgetsOnTrack} healthy
          </span>
          <span className="rounded-full border border-gray-800 px-2 py-1">
            {budgetsAtRisk} at risk
          </span>
          <span className="rounded-full border border-gray-800 px-2 py-1">
            {budgetsOver} over
          </span>
        </div>
      </div>

      {totalBudgets === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
          No budgets set for this month yet. Add budgets to monitor financial limits.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {highlighted.map((item) => {
            const status = statusForRatio(item.usedRatio, riskThreshold);
            const usedPercent = Math.round(item.usedRatio * 100);
            const barPercent = Math.max(0, Math.min(usedPercent, 100));
            const currency = item.wallet?.currency_code ?? "";

            return (
              <div
                key={item.budget.id}
                className="rounded-2xl border border-gray-800 bg-black/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {item.category?.name ?? "Unknown category"}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {item.wallet?.name ?? "All wallets"}
                      {currency ? ` • ${currency}` : ""}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${status.className}`}
                    title={status.helper}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-gray-400">
                    {formatMinor(item.actualMinor)} / {formatMinor(item.budget.amount_minor)} {currency}
                  </span>
                  <span className="tabular-nums text-gray-300">{usedPercent}%</span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full border border-gray-700 bg-black">
                  <div className="h-full bg-white" style={{ width: `${barPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
