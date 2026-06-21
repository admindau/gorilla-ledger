type LargestExpenseItem = {
  id: string;
  categoryName: string;
  walletName: string;
  amountMinor: number;
  currencyCode: string;
  occurredAt: string;
};

type LargestExpenseWidgetProps = {
  item: LargestExpenseItem | null;
  monthLabel: string;
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

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LargestExpenseWidget({
  item,
  monthLabel,
}: LargestExpenseWidgetProps) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Largest Expense</h3>
          <p className="mt-1 text-[11px] text-gray-400">
            Biggest single expense recorded in {monthLabel}.
          </p>
        </div>
        <span className="rounded-full border border-gray-800 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400">
          Peak
        </span>
      </div>

      {!item ? (
        <div className="mt-5 gl-empty-state rounded-2xl p-4 text-sm text-gray-400">
          No expenses recorded for this month yet.
        </div>
      ) : (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {item.categoryName}
          </div>
          <div className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-white">
            {formatMinor(item.amountMinor)}{" "}
            <span className="text-base text-gray-300">{item.currencyCode}</span>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-gray-400">
            <div className="flex items-center justify-between gap-3 gl-inner-card rounded-xl px-3 py-2">
              <span>Wallet</span>
              <span className="text-gray-200">{item.walletName}</span>
            </div>
            <div className="flex items-center justify-between gap-3 gl-inner-card rounded-xl px-3 py-2">
              <span>Date</span>
              <span className="text-gray-200">{formatDate(item.occurredAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
