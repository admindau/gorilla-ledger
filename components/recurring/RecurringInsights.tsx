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

function formatAmount(amountMinor: number, currencyCode = "USD") {
  return `${(amountMinor / 100).toLocaleString()} ${currencyCode}`;
}

function getRuleTitle(rule: RecurringRule, categories: Category[]) {
  const category = categories.find((item) => item.id === rule.category_id);
  return rule.description || category?.name || "Recurring rule";
}

export function RecurringInsights({ rules, runLogs, wallets, categories }: RecurringInsightsProps) {
  const activeRules = rules.filter((rule) => rule.is_active);
  const mostFrequentRule =
    activeRules.find((rule) => rule.frequency === "daily") ??
    activeRules.find((rule) => rule.frequency === "weekly") ??
    activeRules.find((rule) => rule.frequency === "monthly") ??
    activeRules[0];

  const largestExpense = activeRules
    .filter((rule) => rule.type === "expense")
    .sort((a, b) => (b.amount_minor ?? 0) - (a.amount_minor ?? 0))[0];

  const largestIncome = activeRules
    .filter((rule) => rule.type === "income")
    .sort((a, b) => (b.amount_minor ?? 0) - (a.amount_minor ?? 0))[0];

  const upcomingValue = activeRules
    .filter((rule) => rule.next_run_at)
    .reduce((total, rule) => {
      const direction = rule.type === "income" ? 1 : -1;
      return total + direction * (rule.amount_minor ?? 0);
    }, 0);

  const failedRuns = runLogs.filter((log) => log.status === "failed").length;
  const successfulRuns = runLogs.filter((log) => log.status === "success").length;

  const cards = [
    {
      label: "Most Frequent Rule",
      value: mostFrequentRule ? getRuleTitle(mostFrequentRule, categories) : "—",
      detail: mostFrequentRule ? mostFrequentRule.frequency : "No active rules",
    },
    {
      label: "Largest Expense",
      value: largestExpense ? getRuleTitle(largestExpense, categories) : "—",
      detail: largestExpense
        ? formatAmount(largestExpense.amount_minor, largestExpense.currency_code)
        : "No automated expenses",
    },
    {
      label: "Largest Income",
      value: largestIncome ? getRuleTitle(largestIncome, categories) : "—",
      detail: largestIncome
        ? formatAmount(largestIncome.amount_minor, largestIncome.currency_code)
        : "No automated income",
    },
    {
      label: "Upcoming Net Value",
      value: formatAmount(Math.abs(upcomingValue), activeRules[0]?.currency_code ?? "USD"),
      detail: upcomingValue >= 0 ? "Net positive automation" : "Net outgoing automation",
    },
    {
      label: "Run Reliability",
      value: `${successfulRuns} success`,
      detail: `${failedRuns} failed in recent logs`,
    },
    {
      label: "Coverage",
      value: `${new Set(activeRules.map((rule) => rule.wallet_id)).size}`,
      detail: `${wallets.length} wallets available`,
    },
  ];

  return (
    <section className="gl-premium-card p-4">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Insights</p>
        <h2 className="mt-1 text-sm font-semibold text-white">Automation Intelligence</h2>
        <p className="mt-1 text-xs text-gray-500">
          Quick signals about the value, reliability, and coverage of your recurring automation layer.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{card.label}</p>
            <p className="mt-2 truncate text-sm font-semibold text-white">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
