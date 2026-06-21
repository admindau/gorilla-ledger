type ExecutiveHeroCardProps = {
  monthLabel: string;
  healthScore: number;
  healthLabel: string;
  riskLevel: string;
  message: string;
  balanceSummary: string;
  netFlowSummary: string;
  forecastSummary: string;
  alertsCount: number;
  criticalAlertsCount: number;
  forecastConfidence: string;
};

function riskClasses(riskLevel: string) {
  if (riskLevel === "Critical") {
    return {
      border: "border-white/70",
      pill: "border-white/70 text-white",
      glow: "shadow-[0_0_40px_rgba(255,255,255,0.10)]",
    };
  }

  if (riskLevel === "Warning") {
    return {
      border: "border-gray-500",
      pill: "border-gray-500 text-gray-100",
      glow: "shadow-[0_0_32px_rgba(255,255,255,0.07)]",
    };
  }

  if (riskLevel === "Watch") {
    return {
      border: "border-gray-700",
      pill: "border-gray-700 text-gray-200",
      glow: "shadow-[0_0_24px_rgba(255,255,255,0.05)]",
    };
  }

  return {
    border: "border-gray-800",
    pill: "border-gray-800 text-gray-300",
    glow: "shadow-[0_0_0_1px_rgba(255,255,255,0.03)]",
  };
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function ExecutiveHeroCard({
  monthLabel,
  healthScore,
  healthLabel,
  riskLevel,
  message,
  balanceSummary,
  netFlowSummary,
  forecastSummary,
  alertsCount,
  criticalAlertsCount,
  forecastConfidence,
}: ExecutiveHeroCardProps) {
  const safeScore = clampScore(healthScore);
  const classes = riskClasses(riskLevel);

  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border ${classes.border} bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.35))] p-5 sm:p-6 ${classes.glow}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-gray-700 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gray-300">
              Financial Command Center
            </span>
            <span className={`rounded-full border bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${classes.pill}`}>
              {riskLevel}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {monthLabel}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
            {message}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
          <div className="rounded-2xl border border-gray-800 bg-black/45 p-4">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Health Score
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-semibold tabular-nums text-white">
                {safeScore}
              </span>
              <span className="pb-1 text-xs uppercase tracking-wide text-gray-400">
                / 100 · {healthLabel}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-black/45 p-4">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Forecast Confidence
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {forecastConfidence}
            </div>
            <div className="mt-1 text-[11px] text-gray-400">
              Based on recurring rules and activity depth.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Total Balance
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-white">
            {balanceSummary}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Net Cash Flow
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-white">
            {netFlowSummary}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Month-End Forecast
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-white">
            {forecastSummary}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Alerts
          </div>
          <div className="mt-2 text-sm font-semibold text-white">
            {criticalAlertsCount > 0
              ? `${criticalAlertsCount} critical`
              : `${alertsCount} active`}
          </div>
        </div>
      </div>
    </div>
  );
}
