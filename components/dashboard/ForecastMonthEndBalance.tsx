type ForecastEntry = {
  currencyCode: string;
  currentBalanceMinor: number;
  projectedBalanceMinor: number;
  scheduledIncomeMinor: number;
  scheduledExpenseMinor: number;
  scheduledOccurrencesCount: number;
  scheduledRuleCount: number;
};

type ForecastMonthEndBalanceProps = {
  entries: ForecastEntry[];
  scheduledOccurrencesCount: number;
  activeScheduledRuleCount: number;
  monthLabel: string;
  confidence?: string;
  availability?: "available" | "historical-unavailable";
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
  scheduledOccurrencesCount,
  activeScheduledRuleCount,
  monthLabel,
  confidence = "Low",
  availability = "available",
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
            Projection using current balances and every active recurring occurrence due in the period.
          </p>
        </div>
        <span className="rounded-full border border-gray-800 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300">
          {monthLabel}
        </span>
      </div>

      <div className="mt-5 gl-inner-card rounded-2xl p-3">
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

      {availability === "historical-unavailable" ? (
        <div className="mt-3 gl-empty-state rounded-2xl p-4 text-sm text-gray-400">
          Historical month-end forecasting is unavailable because Gorilla Ledger does not yet store balance snapshots. Select the current month or a future month for a reliable projection.
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="mt-3 gl-empty-state rounded-2xl p-4 text-sm text-gray-400">
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
                className="gl-inner-card rounded-2xl p-3 transition hover:bg-white/[0.035]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {entry.currencyCode}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {entry.scheduledOccurrencesCount} occurrence{entry.scheduledOccurrencesCount === 1 ? "" : "s"}
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
                    <span>Scheduled income</span>
                    <span className="tabular-nums text-gray-200">
                      {formatMinor(entry.scheduledIncomeMinor)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Scheduled expense</span>
                    <span className="tabular-nums text-gray-200">
                      {formatMinor(entry.scheduledExpenseMinor)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-white/5 pt-2">
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

      {availability === "available" && (
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span>{scheduledOccurrencesCount} total occurrence{scheduledOccurrencesCount === 1 ? "" : "s"}</span>
        <span>{activeScheduledRuleCount} active rule{activeScheduledRuleCount === 1 ? "" : "s"}</span>
      </div>
      )}

      {availability === "available" && entries.length > visibleEntries.length && (
        <div className="mt-3 text-[11px] text-gray-500">
          +{entries.length - visibleEntries.length} more currency balance(s)
        </div>
      )}
    </div>
  );
}
