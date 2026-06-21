type RecentTransaction = {
  id: string;
  type: "income" | "expense";
  categoryName: string;
  walletName: string;
  amountMinor: number;
  currencyCode: string;
  occurredAt: string;
};

type RecentTransactionsWidgetProps = {
  transactions: RecentTransaction[];
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
  });
}

export default function RecentTransactionsWidget({
  transactions,
  monthLabel,
}: RecentTransactionsWidgetProps) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Recent Transactions</h3>
          <p className="mt-1 text-[11px] text-gray-400">
            Latest non-transfer activity for {monthLabel}.
          </p>
        </div>
        <a
          href="/transactions"
          className="rounded-full border border-gray-800 px-3 py-1 text-[11px] text-gray-300 transition hover:bg-white hover:text-black"
        >
          View all
        </a>
      </div>

      {transactions.length === 0 ? (
        <div className="mt-5 gl-empty-state rounded-2xl p-4 text-sm text-gray-400">
          No recent transactions for this month yet.
        </div>
      ) : (
        <div className="mt-5 divide-y divide-white/10 gl-inner-card rounded-2xl">
          {transactions.map((tx) => {
            const isIncome = tx.type === "income";
            const sign = isIncome ? "+" : "-";

            return (
              <div
                key={tx.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {tx.categoryName}
                    </span>
                    <span className="rounded-full border border-gray-800 px-2 py-0.5 text-[9px] uppercase tracking-wide text-gray-400">
                      {tx.type}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {tx.walletName} • {formatDate(tx.occurredAt)}
                  </div>
                </div>

                <div
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    isIncome ? "text-gray-100" : "text-gray-300"
                  }`}
                >
                  {sign}
                  {formatMinor(tx.amountMinor)} {tx.currencyCode}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
