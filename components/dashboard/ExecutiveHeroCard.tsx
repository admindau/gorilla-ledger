import TrustIndicator from "@/components/ui/TrustIndicator";

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
      className={`gl-hero-card rounded-[1.9rem] p-5 sm:p-7 ${classes.glow}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="gl-section-eyebrow">
              Financial Command Center
            </span>
            <span className={`rounded-full border bg-white/[0.035] px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${classes.pill}`}>
              {riskLevel}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TrustIndicator
              status="success"
              label="Live ledger data"
              detail="Supabase-backed"
            />
            <TrustIndicator
              status="info"
              label="Updated just now"
              detail="Refreshed on page load"
            />
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
            {monthLabel}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
            {message}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[420px]">
          <div className="gl-inner-card rounded-2xl p-4">
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

          <div className="gl-inner-card rounded-2xl p-4">
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

      <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-800 bg-black/35 p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Total Balance
          </div>
          <div className="mt-2 truncate text-xs font-semibold text-white sm:text-sm">
            {balanceSummary}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-black/35 p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Net Cash Flow
          </div>
          <div className="mt-2 truncate text-xs font-semibold text-white sm:text-sm">
            {netFlowSummary}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-black/35 p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Month-End Forecast
          </div>
          <div className="mt-2 truncate text-xs font-semibold text-white sm:text-sm">
            {forecastSummary}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-black/35 p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Alerts
          </div>
          <div className="mt-2 text-xs font-semibold text-white sm:text-sm">
            {criticalAlertsCount > 0
              ? `${criticalAlertsCount} critical`
              : `${alertsCount} active`}
          </div>
        </div>
      </div>
    </div>
  );
}
