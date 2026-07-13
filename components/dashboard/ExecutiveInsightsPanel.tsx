type ExecutiveInsight = {
  id: string;
  label: string;
  value: string;
  helper: string;
};

type ExecutiveInsightsPanelProps = {
  insights: ExecutiveInsight[];
  riskLevel?: string;
};

function riskTone(riskLevel?: string) {
  const value = (riskLevel ?? "").toLowerCase();
  if (value.includes("high") || value.includes("critical")) {
    return "border-white/20 bg-white/[0.08] text-white";
  }
  if (value.includes("medium") || value.includes("watch")) {
    return "border-white/15 bg-white/[0.055] text-gray-200";
  }
  return "border-white/10 bg-white/[0.035] text-gray-300";
}

export default function ExecutiveInsightsPanel({
  insights,
  riskLevel,
}: ExecutiveInsightsPanelProps) {
  const primaryInsight = insights[0];
  const supportingInsights = insights.slice(1, 4);
  const additionalCount = Math.max(0, insights.length - 4);

  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
            Decision brief
          </span>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-white">
            Executive Insights
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-gray-400">
            The most important signals, reduced to a quick read.
          </p>
        </div>

        {riskLevel && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${riskTone(
              riskLevel
            )}`}
          >
            {riskLevel}
          </span>
        )}
      </div>

      {primaryInsight ? (
        <>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-500">
                Priority signal
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)]" />
            </div>
            <p className="mt-3 break-words text-lg font-semibold leading-6 tracking-tight text-white">
              {primaryInsight.value}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-gray-400">
              {primaryInsight.helper}
            </p>
            <div className="mt-4 inline-flex rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-gray-300">
              {primaryInsight.label}
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {supportingInsights.map((insight, index) => (
              <div
                key={insight.id}
                className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 transition-colors hover:bg-white/[0.035]"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 text-[9px] font-semibold text-gray-400">
                  {index + 2}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
                      {insight.label}
                    </p>
                    <p className="max-w-[58%] text-right text-xs font-semibold leading-4 text-gray-100">
                      {insight.value}
                    </p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-500">
                    {insight.helper}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {additionalCount > 0 && (
            <p className="mt-auto pt-4 text-[10px] text-gray-500">
              +{additionalCount} additional signal{additionalCount === 1 ? "" : "s"} included in the wider dashboard analysis.
            </p>
          )}
        </>
      ) : (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/15 p-6 text-center">
          <div>
            <div className="mx-auto h-8 w-8 rounded-full border border-white/10 bg-white/[0.035]" />
            <p className="mt-3 text-sm font-medium text-gray-300">
              No executive signals yet
            </p>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              Insights will appear when enough activity is available.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
