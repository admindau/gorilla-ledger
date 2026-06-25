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
  description: string | null;
  amount_minor: number;
  currency_code: string;
  type: string;
  frequency: string;
  interval: number | null;
  day_of_month: number | null;
  day_of_week: number | null;
  next_run_at: string | null;
  last_run_at: string | null;
  total_runs: number | null;
  is_active: boolean;
};

type RecurringRuleCardProps = {
  rule: RecurringRule;
  wallet?: Wallet;
  category?: Category;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAmount(rule: RecurringRule) {
  return `${((rule.amount_minor ?? 0) / 100).toLocaleString()} ${rule.currency_code}`;
}

function formatFrequency(rule: RecurringRule) {
  const every = rule.interval && rule.interval > 1 ? `Every ${rule.interval}` : "Every";

  switch (rule.frequency) {
    case "daily":
      return `${every} day${rule.interval && rule.interval > 1 ? "s" : ""}`;
    case "weekly":
      return `${every} week${rule.interval && rule.interval > 1 ? "s" : ""}`;
    case "yearly":
      return `${every} year${rule.interval && rule.interval > 1 ? "s" : ""}`;
    case "monthly":
    default:
      return `${every} month${rule.interval && rule.interval > 1 ? "s" : ""}`;
  }
}

function formatSchedule(rule: RecurringRule) {
  if (rule.frequency === "daily") return "Runs daily";
  if (rule.frequency === "weekly") {
    return `Runs weekly${rule.day_of_week != null ? ` on day ${rule.day_of_week}` : ""}`;
  }
  if (rule.frequency === "yearly") {
    return `Runs yearly${rule.day_of_month != null ? ` on day ${rule.day_of_month}` : ""}`;
  }
  return `Runs monthly${rule.day_of_month != null ? ` on day ${rule.day_of_month}` : ""}`;
}

export function RecurringRuleCard({ rule, wallet, category, onToggle, onDelete }: RecurringRuleCardProps) {
  const title = rule.description || category?.name || "Recurring rule";

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg">{rule.type === "income" ? "💰" : "🔁"}</span>
              <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {wallet ? `${wallet.name} • ${wallet.currency_code}` : rule.currency_code}
              {" • "}
              {category?.name ?? "Uncategorized"}
            </p>
          </div>

          <span
            className={[
              "rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em]",
              rule.is_active
                ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-300"
                : "border-gray-600 bg-white/[0.02] text-gray-400",
            ].join(" ")}
          >
            {rule.is_active ? "Active" : "Paused"}
          </span>
        </div>

        <div>
          <p className={rule.type === "income" ? "text-2xl font-semibold text-emerald-300" : "text-2xl font-semibold text-red-300"}>
            {rule.type === "income" ? "+" : "-"}
            {formatAmount(rule)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {formatFrequency(rule)} • {formatSchedule(rule)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Next</p>
            <p className="mt-1 text-gray-200">{formatDate(rule.next_run_at)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Last</p>
            <p className="mt-1 text-gray-200">{formatDate(rule.last_run_at)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Runs</p>
            <p className="mt-1 text-gray-200">{rule.total_runs ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Status</p>
            <p className="mt-1 text-gray-200">{rule.is_active ? "Live" : "Paused"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          {rule.is_active ? (
            <button
              type="button"
              onClick={() => onToggle(false)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-gray-300 transition hover:bg-white/5"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggle(true)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-gray-300 transition hover:bg-white/5"
            >
              Activate
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-red-300 transition hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
