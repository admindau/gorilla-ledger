type SmartAlert = {
  id: string;
  tone: "good" | "watch" | "danger" | "neutral";
  title: string;
  detail: string;
};

type SmartAlertsPanelProps = {
  alerts: SmartAlert[];
  riskLevel?: string;
};

function toneClasses(tone: SmartAlert["tone"]) {
  if (tone === "good") return "border-gray-700 text-gray-200";
  if (tone === "danger") return "border-white/70 text-white";
  if (tone === "watch") return "border-gray-500 text-gray-200";
  return "border-gray-800 text-gray-300";
}

function toneLabel(tone: SmartAlert["tone"]) {
  if (tone === "good") return "Healthy";
  if (tone === "danger") return "Critical";
  if (tone === "watch") return "Watch";
  return "Info";
}

function toneDot(tone: SmartAlert["tone"]) {
  if (tone === "good") return "✓";
  if (tone === "danger") return "!";
  if (tone === "watch") return "•";
  return "i";
}

export default function SmartAlertsPanel({
  alerts,
  riskLevel,
}: SmartAlertsPanelProps) {
  const visibleAlerts = alerts.slice(0, 4);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Smart Alerts</h3>
          <p className="mt-1 text-[11px] text-gray-400">
            Prioritized issues that need attention now.
          </p>
        </div>
        <span className="rounded-full border border-gray-800 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300">
          {riskLevel ?? `${alerts.length} alerts`}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-2xl border bg-black/30 p-3 transition hover:bg-white/[0.03] ${toneClasses(
              alert.tone
            )}`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
                {toneDot(alert.tone)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold text-white">
                    {alert.title}
                  </div>
                  <span className="rounded-full border border-current px-2 py-0.5 text-[9px] uppercase tracking-wide">
                    {toneLabel(alert.tone)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-gray-400">
                  {alert.detail}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {alerts.length > visibleAlerts.length && (
        <div className="mt-3 text-[11px] text-gray-500">
          +{alerts.length - visibleAlerts.length} more alert(s)
        </div>
      )}
    </div>
  );
}
