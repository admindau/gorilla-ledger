import type { DashboardInsightModel } from "@/lib/dashboard/intelligence";

type LargestExpenseWidgetProps = {
  model: DashboardInsightModel;
  walletNamesById: Record<string, string>;
};

function formatMinor(minor: number) {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LargestExpenseWidget({
  model,
  walletNamesById,
}: LargestExpenseWidgetProps) {
  const items = model.currencies.flatMap((currency) =>
    currency.largestExpense ? [currency.largestExpense] : []
  );
  const monthLabel = model.filters.period.label;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Largest Expense</h3>
          <p className="mt-1 text-[11px] text-gray-400">Biggest single expense per currency in {monthLabel}.</p>
        </div>
        <span className="rounded-full border border-gray-800 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400">Currency-safe</span>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 gl-empty-state rounded-2xl p-4 text-sm text-gray-400">No expenses recorded for this month yet.</div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {items.map((item) => (
            <div key={`${item.currencyCode}-${item.id}`} className="gl-inner-card rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-[11px] uppercase tracking-wide text-gray-500">{item.categoryName ?? "Uncategorized"}</div>
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-300">{item.currencyCode}</span>
              </div>
              <div className="mt-3 text-2xl font-semibold leading-none tracking-tight tabular-nums text-white">{formatMinor(item.amountMinor)}</div>
              <div className="mt-4 grid gap-2 text-[11px] text-gray-400">
                <div className="flex items-center justify-between gap-3"><span>Wallet</span><span className="truncate text-right text-gray-200">{walletNamesById[item.walletId] ?? "Unknown wallet"}</span></div>
                <div className="flex items-center justify-between gap-3"><span>Date</span><span className="text-gray-200">{formatDate(item.occurredAt)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
