type ForecastEntry = {
  currencyCode: string;
  currentBalanceMinor: number;
  projectedBalanceMinor: number;
  scheduledIncomeMinor: number;
  scheduledExpenseMinor: number;
};

type ForecastMonthEndBalanceProps = {
  entries: ForecastEntry[];
  scheduledRulesCount: number;
  monthLabel: string;
  confidence?: string;
};

function formatMinor(minor: number) {
  const sign = minor < 0 ? "-" : "";
  return `${sign}${Math.abs(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function confidenceHelper(confidence?: string) {
  if (confidence === "High") return "Recurring rules and activity history are sufficient.";
  if (confidence === "Medium") return "Some recurring or recent activity exists.";
  return "Add recurring rules and more transactions to improve confidence.";
}

export default function ForecastMonthEndBalance({
  entries,
  scheduledRulesCount,
  monthLabel,
  confidence = "Low",
}: ForecastMonthEndBalanceProps) {
  const visibleEntries = entries.slice(0, 3);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Forecasted Month-End
          </h3>
          <p className="mt-1 text-[11px] text-gray-400">
            Projection using current balances and active recurring rules.
          </p>
        </div>
        <span className="rounded-full border border-gray-800 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300">
          {monthLabel}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-gray-800 bg-black/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Forecast Confidence
          </div>
          <div className="text-xs font-semibold text-white">{confidence}</div>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-gray-400">
          {confidenceHelper(confidence)}
        </p>
      </div>

      {visibleEntries.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
          No wallet balances available yet. Create a wallet to unlock forecasting.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {visibleEntries.map((entry) => {
            const movementMinor =
              entry.scheduledIncomeMinor - entry.scheduledExpenseMinor;

            return (
              <div
                key={entry.currencyCode}
                className="rounded-2xl border border-gray-800 bg-black/30 p-3 transition hover:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {entry.currencyCode}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {scheduledRulesCount} scheduled
                  </div>
                </div>

                <div className="mt-3 text-2xl font-semibold tabular-nums text-white">
                  {formatMinor(entry.projectedBalanceMinor)}{" "}
                  <span className="text-sm text-gray-300">
                    {entry.currencyCode}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-[11px] text-gray-400">
                  <div className="flex justify-between gap-3">
                    <span>Current</span>
                    <span className="tabular-nums text-gray-200">
                      {formatMinor(entry.currentBalanceMinor)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Scheduled movement</span>
                    <span className="tabular-nums text-gray-200">
                      {formatMinor(movementMinor)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {entries.length > visibleEntries.length && (
        <div className="mt-3 text-[11px] text-gray-500">
          +{entries.length - visibleEntries.length} more currency balance(s)
        </div>
      )}
    </div>
  );
}
