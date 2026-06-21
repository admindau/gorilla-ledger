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

export default function ExecutiveInsightsPanel({
  insights,
  riskLevel,
}: ExecutiveInsightsPanelProps) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Executive Insights
          </h3>
          <p className="mt-1 text-[11px] text-gray-400">
            Short readout for quick decisions.
          </p>
        </div>
        {riskLevel && (
          <span className="rounded-full border border-gray-800 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300">
            {riskLevel}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-2xl border border-gray-800 bg-black/30 p-3 transition hover:bg-white/[0.03]"
          >
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              {insight.label}
            </div>
            <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
              {insight.value}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-gray-400">
              {insight.helper}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
