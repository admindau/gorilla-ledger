import { MetricGridState, type DataState } from "@/components/ui/MetricGridState";
import { browserTimeZone, calendarMonthKey } from "@/lib/time/ledgerTime";

type RecurringRule = {
  id: string;
  amount_minor: number;
  currency_code: string;
  type: string;
  next_run_at: string | null;
  last_run_at?: string | null;
  is_active: boolean;
};

type RecurringRunLog = {
  id: string;
  run_at: string;
  status: string;
};

type RecurringCommandCenterProps = {
  rules: RecurringRule[];
  runLogs: RecurringRunLog[];
  dataState?: DataState;
};

function isThisMonth(value: string | null) {
  if (!value) return false;
  const timeZone = browserTimeZone();
  return calendarMonthKey(value, timeZone) === calendarMonthKey(new Date(), timeZone);
}

function isUpcoming(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= new Date().setHours(0, 0, 0, 0);
}

function formatRunDate(value: string | null | undefined) {
  if (!value) return "None scheduled";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "None scheduled";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAutomationHealth(runLogs: RecurringRunLog[]) {
  if (runLogs.length === 0) {
    return { score: 100, label: "Ready" };
  }

  const recentLogs = runLogs.slice(0, 12);
  const failed = recentLogs.filter((log) => log.status === "failed").length;
  const skipped = recentLogs.filter((log) => log.status === "skipped").length;
  const penalty = failed * 18 + skipped * 8;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  if (score >= 90) return { score, label: "Excellent" };
  if (score >= 75) return { score, label: "Stable" };
  if (score >= 55) return { score, label: "Needs Review" };
  return { score, label: "At Risk" };
}

function getNextRun(rules: RecurringRule[]) {
  const upcoming = rules
    .filter((rule) => rule.is_active && isUpcoming(rule.next_run_at))
    .sort((a, b) => {
      const aTime = new Date(a.next_run_at ?? "").getTime();
      const bTime = new Date(b.next_run_at ?? "").getTime();
      return aTime - bTime;
    });

  return upcoming[0]?.next_run_at ?? null;
}

export function RecurringCommandCenter({
  rules,
  runLogs,
  dataState = "ready",
}: RecurringCommandCenterProps) {
  if (dataState !== "ready") return <MetricGridState state={dataState} />;

  const activeRules = rules.filter((rule) => rule.is_active);
  const upcomingRuns = activeRules.filter((rule) => isUpcoming(rule.next_run_at));
  const executedThisMonth = runLogs.filter(
    (log) => log.status === "success" && isThisMonth(log.run_at)
  ).length;
  const health = getAutomationHealth(runLogs);
  const nextRun = getNextRun(rules);

  const cards = [
    {
      label: "Active Rules",
      value: activeRules.length.toLocaleString(),
      detail: `${rules.length.toLocaleString()} total`,
    },
    {
      label: "Next run",
      value: formatRunDate(nextRun),
      detail: `${upcomingRuns.length.toLocaleString()} upcoming`,
    },
    {
      label: "Runs this month",
      value: executedThisMonth.toLocaleString(),
      detail: "Completed successfully",
    },
    {
      label: "Recent success",
      value: `${health.score}%`,
      detail: health.label,
    },
  ];

  return (
    <section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="gl-premium-card p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
