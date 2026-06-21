type FinancialHealthScoreProps = {
  score: number;
  label: string;
  cashFlowMinor: number;
  budgetPressureCount: number;
  activeBudgetsCount: number;
  monthLabel: string;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatMinor(minor: number) {
  const sign = minor < 0 ? "-" : "";
  return `${sign}${Math.abs(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function scoreTone(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Watch";
  return "Needs attention";
}

export default function FinancialHealthScore({
  score,
  label,
  cashFlowMinor,
  budgetPressureCount,
  activeBudgetsCount,
  monthLabel,
}: FinancialHealthScoreProps) {
  const safeScore = clampScore(score);
  const circumference = 2 * Math.PI * 44;
  const dash = (safeScore / 100) * circumference;
  const tone = label || scoreTone(safeScore);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Financial Health Score
          </h3>
          <p className="mt-1 text-[11px] text-gray-400">
            Composite score for {monthLabel}.
          </p>
        </div>

        <span className="rounded-full border border-gray-800 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300">
          {tone}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="rgba(31,41,55,0.95)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              className="text-white"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-semibold tabular-nums text-white">
              {safeScore}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              / 100
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3 text-xs">
          <div className="rounded-2xl border border-gray-800 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Cash flow
            </div>
            <div className="mt-1 font-semibold tabular-nums text-white">
              {formatMinor(cashFlowMinor)}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Budget pressure
            </div>
            <div className="mt-1 font-semibold text-white">
              {budgetPressureCount} of {activeBudgetsCount}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-gray-400">
        {safeScore >= 70
          ? "Your selected month is currently in a manageable position."
          : "This month needs closer attention. Review alerts, budgets, and upcoming recurring activity."}
      </p>
    </div>
  );
}
