type ExecutiveScorecardRowProps = {
  healthScore: number;
  riskLevel: string;
  forecastConfidence: string;
  forecastSummary: string;
  budgetsOnTrack: number;
  budgetsAtRisk: number;
  budgetsOver: number;
  alertsCount: number;
  criticalAlertsCount: number;
};

function scoreStatus(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Watch";
  return "Needs review";
}

function cardClass(riskLevel: string) {
  if (riskLevel === "Critical") return "border-white/70";
  if (riskLevel === "Warning") return "border-gray-500";
  if (riskLevel === "Watch") return "border-gray-700";
  return "border-gray-800";
}

export default function ExecutiveScorecardRow({
  healthScore,
  riskLevel,
  forecastConfidence,
  forecastSummary,
  budgetsOnTrack,
  budgetsAtRisk,
  budgetsOver,
  alertsCount,
  criticalAlertsCount,
}: ExecutiveScorecardRowProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(healthScore || 0)));
  const riskBorder = cardClass(riskLevel);

  const cards = [
    {
      label: "Financial Health",
      value: `${safeScore}/100`,
      helper: scoreStatus(safeScore),
      border: riskBorder,
    },
    {
      label: "Risk Level",
      value: riskLevel,
      helper:
        criticalAlertsCount > 0
          ? `${criticalAlertsCount} critical alert(s)`
          : `${alertsCount} monitored alert(s)`,
      border: riskBorder,
    },
    {
      label: "Forecast",
      value: forecastSummary,
      helper: `${forecastConfidence} confidence`,
      border: "border-gray-800",
    },
    {
      label: "Budget Position",
      value: `${budgetsOnTrack}/${budgetsOnTrack + budgetsAtRisk + budgetsOver}`,
      helper: `${budgetsAtRisk} at risk · ${budgetsOver} over`,
      border: budgetsOver > 0 ? "border-white/70" : budgetsAtRisk > 0 ? "border-gray-500" : "border-gray-800",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border ${card.border} bg-black/40 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition hover:bg-white/[0.03]`}
        >
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            {card.label}
          </div>
          <div className="mt-2 truncate text-lg font-semibold tracking-tight text-white">
            {card.value}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">{card.helper}</div>
        </div>
      ))}
    </div>
  );
}
