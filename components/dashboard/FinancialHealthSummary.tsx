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

function formatMinor(minor: number) {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  const hasActivity = incomeEntries.some(([, value]) => value > 0) ||
    expenseEntries.some(([, value]) => value > 0);
  const hasNegativeCurrency = netEntries.some(([, value]) => value < 0);
  const budgetPressure = budgetsOver > 0 || budgetsAtRisk > 0;

  const headline = !hasActivity
    ? "No activity yet"
    : hasNegativeCurrency
    ? "Currency needs attention"
    : budgetPressure
    ? "Watch budgets"
    : "Healthy month";

  const tone: "good" | "watch" | "neutral" =
    !hasActivity ? "neutral" : !hasNegativeCurrency && !budgetPressure ? "good" : "watch";

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
        <div className="gl-inner-card rounded-2xl p-3">
          <div className="text-xs text-gray-500">Net cash flow by currency</div>
          {netEntries.length === 0 ? (
            <div className="mt-2 text-lg font-semibold tabular-nums">0.00</div>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {netEntries.map(([currency, minor]) => (
                <div key={currency} className="rounded-xl border border-gray-800 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                    {currency}
                  </div>
                  <div className="mt-1 text-base font-semibold tabular-nums text-white">
                    {formatMinor(minor)} {currency}
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    {minor < 0 ? "Expenses exceeded income" : minor > 0 ? "Income exceeded expenses" : "Income matched expenses"}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Each currency is assessed independently. No FX conversion is applied.
          </p>
        </div>

        <div className="gl-inner-card rounded-2xl p-3">
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
                <div className="text-lg font-semibold tabular-nums">{budgetsOnTrack}</div>
                <div className="text-gray-500">On track</div>
              </div>
              <div className="rounded-xl border border-gray-800 p-2">
                <div className="text-lg font-semibold tabular-nums">{budgetsAtRisk}</div>
                <div className="text-gray-500">At risk</div>
              </div>
              <div className="rounded-xl border border-gray-800 p-2">
                <div className="text-lg font-semibold tabular-nums">{budgetsOver}</div>
                <div className="text-gray-500">Over</div>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs leading-relaxed text-gray-500">
          {headline === "Healthy month"
            ? "Every active currency has non-negative cash flow and budgets are currently under control."
            : headline === "Watch budgets"
            ? "Cash flow is non-negative across currencies, but one or more budgets need attention."
            : headline === "Currency needs attention"
            ? "At least one currency has negative cash flow. Review each currency independently."
            : "Add transactions and budgets to activate financial health insights."}
        </p>
      </div>
    </div>
  );
}
