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

type RecurringTimelineProps = {
  rules: RecurringRule[];
  wallets: Wallet[];
  categories: Category[];
  loading?: boolean;
};

function formatAmount(rule: RecurringRule) {
  return `${((rule.amount_minor ?? 0) / 100).toLocaleString()} ${rule.currency_code}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDateKey(value: string | null) {
  if (!value) return "Unscheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((dateStart.getTime() - todayStart.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return formatDate(value);
}

function getRuleTitle(rule: RecurringRule, categories: Category[]) {
  const category = categories.find((item) => item.id === rule.category_id);
  return rule.description || category?.name || "Recurring rule";
}

export function RecurringTimeline({ rules, wallets, categories, loading = false }: RecurringTimelineProps) {
  const upcomingRules = rules
    .filter((rule) => rule.is_active && rule.next_run_at)
    .sort((a, b) => {
      const aTime = new Date(a.next_run_at ?? "").getTime();
      const bTime = new Date(b.next_run_at ?? "").getTime();
      return aTime - bTime;
    })
    .slice(0, 8);

  const groups = upcomingRules.reduce<Record<string, RecurringRule[]>>((acc, rule) => {
    const key = getDateKey(rule.next_run_at);
    acc[key] = acc[key] ?? [];
    acc[key].push(rule);
    return acc;
  }, {});

  return (
    <section className="gl-premium-card p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Timeline</p>
          <h2 className="mt-1 text-sm font-semibold text-white">Upcoming Automation Timeline</h2>
          <p className="mt-1 text-xs text-gray-500">
            A forward view of scheduled recurring transactions based on each rule&apos;s next run date.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-gray-400">
          {upcomingRules.length} upcoming
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading upcoming automations…</p>
      ) : upcomingRules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm">
          <p className="font-medium text-white">No upcoming automations</p>
          <p className="mt-1 text-xs text-gray-500">
            Activate a recurring rule with a next run date to populate the automation timeline.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groups).map(([label, groupRules]) => (
            <div key={label} className="relative pl-5">
              <div className="absolute left-1 top-2 h-[calc(100%-0.5rem)] w-px bg-white/10" />
              <div className="mb-3 flex items-center gap-3">
                <span className="absolute left-0 h-2.5 w-2.5 rounded-full bg-white" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                  {label}
                </p>
              </div>

              <div className="space-y-2">
                {groupRules.map((rule) => {
                  const wallet = wallets.find((item) => item.id === rule.wallet_id);
                  const category = categories.find((item) => item.id === rule.category_id);

                  return (
                    <div
                      key={rule.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base">{rule.type === "income" ? "💰" : "🔁"}</span>
                            <p className="truncate text-sm font-semibold text-white">
                              {getRuleTitle(rule, categories)}
                            </p>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-gray-400">
                              {rule.frequency}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {wallet?.name ?? "Wallet"} • {category?.name ?? "Uncategorized"} • Next run {formatDate(rule.next_run_at)}
                          </p>
                        </div>
                        <p className={rule.type === "income" ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
                          {rule.type === "income" ? "+" : "-"}
                          {formatAmount(rule)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
