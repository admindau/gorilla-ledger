import TrustIndicator from "@/components/ui/TrustIndicator";

type ExecutiveHeroCardProps = {
  monthLabel: string;
  healthScore: number;
  healthLabel: string;
  healthCurrency: string;
  riskLevel: string;
  message: string;
  forecastConfidence: string;
};

function riskClasses(riskLevel: string) {
  if (riskLevel === "Critical") {
    return {
      border: "border-red-400/50",
      pill: "border-red-400/40 bg-red-400/10 text-red-200",
      glow: "shadow-[0_0_36px_rgba(248,113,113,0.10)]",
    };
  }

  if (riskLevel === "Warning") {
    return {
      border: "border-amber-400/40",
      pill: "border-amber-400/30 bg-amber-400/10 text-amber-200",
      glow: "shadow-[0_0_28px_rgba(251,191,36,0.08)]",
    };
  }

  if (riskLevel === "Watch") {
    return {
      border: "border-amber-300/25",
      pill: "border-amber-300/20 bg-amber-300/[0.07] text-amber-100",
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
  healthCurrency,
  riskLevel,
  message,
  forecastConfidence,
}: ExecutiveHeroCardProps) {
  const safeScore = clampScore(healthScore);
  const classes = riskClasses(riskLevel);

  return (
    <div
      className={`gl-hero-card gl-dashboard-hero-slot rounded-[1.9rem] p-5 sm:p-7 ${classes.glow}`}
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
              label="Synced recently"
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

        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:min-w-[420px]">
          <div className="gl-inner-card rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Health Score
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-semibold tabular-nums text-white">
                {safeScore}
              </span>
              <span className="pb-1 text-xs uppercase tracking-wide text-gray-400">
                / 100 · {healthLabel} · {healthCurrency}
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

    </div>
  );
}
