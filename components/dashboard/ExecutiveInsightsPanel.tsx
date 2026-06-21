type ExecutiveInsight = {
  id: string;
  label: string;
  value: string;
  helper: string;
};

type ExecutiveInsightsPanelProps = {
  insights: ExecutiveInsight[];
};

export default function ExecutiveInsightsPanel({
  insights,
}: ExecutiveInsightsPanelProps) {
  return (
    <div>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">
          Executive Insights
        </h3>
        <p className="mt-1 text-[11px] text-gray-400">
          Short readout for quick decisions.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-2xl border border-gray-800 bg-black/30 p-3"
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
