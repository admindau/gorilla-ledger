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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="gl-premium-card min-w-0 rounded-[1.25rem] p-3.5 sm:p-4"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
            {stat.label}
          </div>
          <div className="mt-3 text-2xl font-semibold sm:text-3xl leading-none tracking-[-0.04em] tabular-nums text-white">
            {stat.value}
          </div>
          <div className="mt-2 text-xs text-gray-400">{stat.helper}</div>
        </div>
      ))}
    </div>
  );
}
