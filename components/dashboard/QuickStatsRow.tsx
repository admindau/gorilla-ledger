type QuickStatsRowProps = {
  walletsCount: number;
  monthTransactionsCount: number;
  categoriesCount: number;
  activeBudgetsCount: number;
};

function plural(value: number, singular: string, pluralLabel: string) {
  return value === 1 ? singular : pluralLabel;
}

export default function QuickStatsRow({
  walletsCount,
  monthTransactionsCount,
  categoriesCount,
  activeBudgetsCount,
}: QuickStatsRowProps) {
  const stats = [
    {
      label: "Wallets",
      value: walletsCount,
      helper: plural(walletsCount, "wallet tracked", "wallets tracked"),
    },
    {
      label: "Transactions",
      value: monthTransactionsCount,
      helper: "this month",
    },
    {
      label: "Expense Categories",
      value: categoriesCount,
      helper: plural(categoriesCount, "category active", "categories active"),
    },
    {
      label: "Active Budgets",
      value: activeBudgetsCount,
      helper: "selected month",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-gray-800 bg-black/40 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
        >
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {stat.label}
          </div>
          <div className="mt-3 text-3xl font-semibold leading-none tracking-tight tabular-nums text-white">
            {stat.value}
          </div>
          <div className="mt-2 text-xs text-gray-400">{stat.helper}</div>
        </div>
      ))}
    </div>
  );
}
