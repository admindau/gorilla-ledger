import TrustIndicator from "@/components/ui/TrustIndicator";
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

function formatTrustDateTime(value: string | null | undefined) {
  if (!value) return "Awaiting first run";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Awaiting first run";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTrustDate(value: string | null | undefined) {
  if (!value) return "No scheduled run";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No scheduled run";

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
  const latestRun = runLogs[0] ?? null;
  const nextRun = getNextRun(rules);

  const healthStatus =
    health.score >= 75 ? "success" : health.score >= 55 ? "warning" : "warning";
  const latestRunStatus =
    !latestRun ? "info" : latestRun.status === "success" ? "success" : "warning";

  const cards = [
    {
      label: "Active Rules",
      value: activeRules.length.toLocaleString(),
      detail: `${rules.length.toLocaleString()} total rules`,
    },
    {
      label: "Upcoming Runs",
      value: upcomingRuns.length.toLocaleString(),
      detail: "Scheduled from today onward",
    },
    {
      label: "Executed This Month",
      value: executedThisMonth.toLocaleString(),
      detail: "Successful materializations",
    },
    {
      label: "Automation Health",
      value: `${health.score}%`,
      detail: health.label,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="gl-premium-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Automation trust layer
            </p>
            <h2 className="mt-2 text-sm font-semibold text-white">
              Recurring engine confidence
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
              Trust signals are calculated from active recurring rules, recent cron logs,
              and the next scheduled materialization.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <TrustIndicator
              status={healthStatus}
              label={health.score >= 75 ? "Automation Healthy" : "Review Automation"}
              detail={health.label}
            />
            <TrustIndicator
              status={latestRunStatus}
              label={!latestRun ? "Awaiting First Run" : "Last Run"}
              detail={latestRun ? formatTrustDateTime(latestRun.run_at) : undefined}
            />
            <TrustIndicator
              status={nextRun ? "success" : "info"}
              label={nextRun ? "Next Run Scheduled" : "No Run Scheduled"}
              detail={formatTrustDate(nextRun)}
            />
          </div>
        </div>
      </div>

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
