"use client";

type MoneyEntry = readonly [string, number];

type Props = {
  incomeEntries: MoneyEntry[];
  expenseEntries: MoneyEntry[];
  netEntries: MoneyEntry[];
  totalBudgets: number;
  budgetsOnTrack: number;
  budgetsAtRisk: number;
  budgetsOver: number;
  monthLabel: string;
};

function totalMinor(entries: MoneyEntry[]) {
  return entries.reduce((sum, [, minor]) => sum + minor, 0);
}

function formatMinor(minor: number) {
  return (minor / 100).toFixed(2);
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "watch" | "neutral";
}) {
  const classes =
    tone === "good"
      ? "border-white/60 text-white"
      : tone === "watch"
      ? "border-gray-500 text-gray-200"
      : "border-gray-700 text-gray-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${classes}`}
    >
      {label}
    </span>
  );
}

export default function FinancialHealthSummary({
  incomeEntries,
  expenseEntries,
  netEntries,
  totalBudgets,
  budgetsOnTrack,
  budgetsAtRisk,
  budgetsOver,
  monthLabel,
}: Props) {
  const incomeTotal = totalMinor(incomeEntries);
  const expenseTotal = totalMinor(expenseEntries);
  const netTotal = totalMinor(netEntries);

  const hasActivity = incomeTotal > 0 || expenseTotal > 0;
  const budgetPressure = budgetsOver > 0 || budgetsAtRisk > 0;

  const headline = !hasActivity
    ? "No activity yet"
    : netTotal >= 0 && !budgetPressure
    ? "Healthy month"
    : netTotal >= 0 && budgetPressure
    ? "Watch budgets"
    : "Negative cash flow";

  const tone: "good" | "watch" | "neutral" =
    !hasActivity ? "neutral" : netTotal >= 0 && !budgetPressure ? "good" : "watch";

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Financial Health
          </h3>
          <p className="text-xs text-gray-500">{monthLabel}</p>
        </div>
        <StatusPill label={headline} tone={tone} />
      </div>

      <div className="grid gap-2 text-sm">
        <div className="rounded-2xl border border-gray-800 bg-black/30 p-3">
          <div className="text-xs text-gray-500">Net cash flow snapshot</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {netEntries.length === 0
              ? "0.00"
              : netEntries
                  .map(([currency, minor]) => `${formatMinor(minor)} ${currency}`)
                  .join(" • ")}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Income minus expenses. Currencies are not converted.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-black/30 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-gray-500">Budget pressure</span>
            <span className="text-gray-300 tabular-nums">
              {totalBudgets} {totalBudgets === 1 ? "budget" : "budgets"}
            </span>
          </div>

          {totalBudgets === 0 ? (
            <p className="text-xs text-gray-500">
              No budgets set for this month yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-gray-800 p-2">
                <div className="text-lg font-semibold tabular-nums">
                  {budgetsOnTrack}
                </div>
                <div className="text-gray-500">On track</div>
              </div>
              <div className="rounded-xl border border-gray-800 p-2">
                <div className="text-lg font-semibold tabular-nums">
                  {budgetsAtRisk}
                </div>
                <div className="text-gray-500">At risk</div>
              </div>
              <div className="rounded-xl border border-gray-800 p-2">
                <div className="text-lg font-semibold tabular-nums">
                  {budgetsOver}
                </div>
                <div className="text-gray-500">Over</div>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs leading-relaxed text-gray-500">
          {headline === "Healthy month"
            ? "Your cash flow is positive and your budgets are currently under control."
            : headline === "Watch budgets"
            ? "Cash flow is positive, but one or more budgets need attention."
            : headline === "Negative cash flow"
            ? "Expenses are currently higher than income for this month."
            : "Add transactions and budgets to activate financial health insights."}
        </p>
      </div>
    </div>
  );
}
