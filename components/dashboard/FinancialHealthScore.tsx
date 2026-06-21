type FinancialHealthScoreProps = {
  score: number;
  label: string;
  riskLevel?: string;
  cashFlowMinor: number;
  budgetPressureCount: number;
  activeBudgetsCount: number;
  monthLabel: string;
};

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatMinor(minor: number) {
  const sign = minor < 0 ? "-" : "";
  return `${sign}${Math.abs(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ringTone(score: number, riskLevel?: string) {
  if (riskLevel === "Critical" || score < 45) return "border-white/70 text-white";
  if (riskLevel === "Warning" || score < 65) return "border-gray-500 text-gray-100";
  if (riskLevel === "Watch" || score < 80) return "border-gray-700 text-gray-200";
  return "border-gray-800 text-gray-300";
}

export default function FinancialHealthScore({
  score,
  label,
  riskLevel,
  cashFlowMinor,
  budgetPressureCount,
  activeBudgetsCount,
  monthLabel,
}: FinancialHealthScoreProps) {
  const safeScore = clampScore(score);
  const circumference = 2 * Math.PI * 44;
  const dash = (safeScore / 100) * circumference;
  const tone = ringTone(safeScore, riskLevel);

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

        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${tone}`}>
          {riskLevel ?? label}
        </span>
      </div>

      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
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
              className="text-white transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-semibold tabular-nums text-white">
              {safeScore}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              {label}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 text-xs sm:grid-cols-1">
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
        {safeScore >= 80
          ? "Strong position. Continue monitoring budgets and recurring commitments."
          : safeScore >= 60
          ? "Manageable position. Review alerts and protect your net cash flow."
          : "This month needs closer attention. Prioritize cash flow, budgets, and upcoming recurring activity."}
      </p>
    </div>
  );
}
