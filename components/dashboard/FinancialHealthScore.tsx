type CurrencyHealthEntry = {
  currencyCode: string;
  score: number;
  label: string;
  riskLevel: "Healthy" | "Watch" | "Warning" | "Critical";
  cashFlowMinor: number;
  budgetPressureCount: number;
  activeBudgetsCount: number;
};

type FinancialHealthScoreProps = {
  entries: CurrencyHealthEntry[];
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

function tone(riskLevel: CurrencyHealthEntry["riskLevel"]) {
  if (riskLevel === "Critical") return "border-white/70 text-white";
  if (riskLevel === "Warning") return "border-gray-500 text-gray-100";
  if (riskLevel === "Watch") return "border-gray-700 text-gray-200";
  return "border-gray-800 text-gray-300";
}

export default function FinancialHealthScore({
  entries,
  monthLabel,
}: FinancialHealthScoreProps) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Financial Health
          </h3>
          <p className="mt-1 text-[11px] text-gray-400">
            Independent scores for each active currency in {monthLabel}.
          </p>
        </div>
        <span className="rounded-full border border-gray-800 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400">
          No FX mixing
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="mt-5 gl-empty-state rounded-2xl p-4 text-sm text-gray-400">
          Add activity to generate currency-specific health scores.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {entries.map((entry) => {
            const score = clampScore(entry.score);
            const circumference = 2 * Math.PI * 30;
            const dash = (score / 100) * circumference;

            return (
              <div key={entry.currencyCode} className="gl-inner-card rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-300">
                    {entry.currencyCode}
                  </span>
                  <span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-wide ${tone(entry.riskLevel)}`}>
                    {entry.riskLevel}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0">
                    <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
                      <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(31,41,55,0.95)" strokeWidth="6" />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        className="text-white transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums text-white">
                      {score}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">
                      {entry.label}
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-wide text-gray-500">
                      Cash flow
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold tabular-nums text-gray-200">
                      {formatMinor(entry.cashFlowMinor)} {entry.currencyCode}
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">
                      {entry.budgetPressureCount} of {entry.activeBudgetsCount} budgets under pressure
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-5 text-gray-500">
        Scores are calculated independently. SSP and USD are never combined or compared without an approved FX layer.
      </p>
    </div>
  );
}
