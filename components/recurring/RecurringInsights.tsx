type Wallet = {
  id: string;
  name: string;
  currency_code: string;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

type RecurringRule = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  description: string | null;
  amount_minor: number;
  currency_code: string;
  type: string;
  frequency: string;
  next_run_at: string | null;
  is_active: boolean;
};

type RecurringRunLog = {
  id: string;
  status: string;
};

type RecurringInsightsProps = {
  rules: RecurringRule[];
  runLogs: RecurringRunLog[];
  wallets: Wallet[];
  categories: Category[];
};

function formatAmount(amountMinor: number, currencyCode: string) {
  return `${(amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode}`;
}

function getRuleTitle(rule: RecurringRule, categories: Category[]) {
  const category = categories.find((item) => item.id === rule.category_id);
  return rule.description || category?.name || "Recurring rule";
}

export function RecurringInsights({
  rules,
  runLogs,
  wallets,
  categories,
}: RecurringInsightsProps) {
  const activeRules = rules.filter((rule) => rule.is_active);
  const mostFrequentRule =
    activeRules.find((rule) => rule.frequency === "daily") ??
    activeRules.find((rule) => rule.frequency === "weekly") ??
    activeRules.find((rule) => rule.frequency === "monthly") ??
    activeRules[0];

  const currencies = Array.from(
    new Set(activeRules.map((rule) => rule.currency_code))
  ).sort();

  const currencyCards = currencies.flatMap((currencyCode) => {
    const currencyRules = activeRules.filter(
      (rule) => rule.currency_code === currencyCode
    );
    const largestExpense = currencyRules
      .filter((rule) => rule.type === "expense")
      .sort((a, b) => b.amount_minor - a.amount_minor)[0];
    const largestIncome = currencyRules
      .filter((rule) => rule.type === "income")
      .sort((a, b) => b.amount_minor - a.amount_minor)[0];
    const upcomingNetMinor = currencyRules
      .filter((rule) => rule.next_run_at)
      .reduce(
        (total, rule) =>
          total + (rule.type === "income" ? 1 : -1) * rule.amount_minor,
        0
      );

    return [
      {
        key: `${currencyCode}-expense`,
        label: `${currencyCode} Largest Expense`,
        value: largestExpense
          ? getRuleTitle(largestExpense, categories)
          : "—",
        detail: largestExpense
          ? formatAmount(largestExpense.amount_minor, currencyCode)
          : "No automated expenses",
      },
      {
        key: `${currencyCode}-income`,
        label: `${currencyCode} Largest Income`,
        value: largestIncome ? getRuleTitle(largestIncome, categories) : "—",
        detail: largestIncome
          ? formatAmount(largestIncome.amount_minor, currencyCode)
          : "No automated income",
      },
      {
        key: `${currencyCode}-net`,
        label: `${currencyCode} Upcoming Net`,
        value: formatAmount(Math.abs(upcomingNetMinor), currencyCode),
        detail:
          upcomingNetMinor >= 0
            ? "Net positive next occurrences"
            : "Net outgoing next occurrences",
      },
    ];
  });

  const failedRuns = runLogs.filter((log) => log.status === "failed").length;
  const successfulRuns = runLogs.filter((log) => log.status === "success").length;

  const cards = [
    {
      key: "frequency",
      label: "Most Frequent Rule",
      value: mostFrequentRule
        ? getRuleTitle(mostFrequentRule, categories)
        : "—",
      detail: mostFrequentRule ? mostFrequentRule.frequency : "No active rules",
    },
    ...currencyCards,
    {
      key: "reliability",
      label: "Run Reliability",
      value: `${successfulRuns} success`,
      detail: `${failedRuns} failed in recent logs`,
    },
    {
      key: "coverage",
      label: "Coverage",
      value: `${new Set(activeRules.map((rule) => rule.wallet_id)).size}`,
      detail: `${wallets.length} wallets available`,
    },
  ];

  return (
    <section className="gl-premium-card p-4">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
          Insights
        </p>
        <h2 className="mt-1 text-sm font-semibold text-white">
          Recurring summary
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Value, reliability, and wallet coverage for your recurring transactions.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
              {card.label}
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-white">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-gray-500">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
