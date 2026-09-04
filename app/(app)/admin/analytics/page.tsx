"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataLoadAlert } from "@/components/ui/DataLoadAlert";
import { AnalyticsLoadingSkeleton } from "@/components/ui/PlatformLoading";

type DailyPoint = { date: string; new_users: number; active_users: number };
type UsageMetrics = {
  generated_at: string;
  total_users: number;
  new_users_24h: number;
  new_users_7d: number;
  new_users_30d: number;
  live_users_5m: number;
  active_users_24h: number;
  active_users_7d: number;
  active_users_30d: number;
  returning_users_30d: number;
  daily: DailyPoint[];
};

const number = new Intl.NumberFormat();

function Metric({ label, value, detail, live = false }: { label: string; value: number; detail: string; live?: boolean }) {
  return (
    <Card variant="inner" className="gl-usage-metric">
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <p>{label}</p>
          {live ? <Badge variant="success">Live</Badge> : null}
        </div>
        <strong>{number.format(value)}</strong>
        <span>{detail}</span>
      </CardBody>
    </Card>
  );
}

export default function PlatformAnalyticsPage() {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const request = await fetch("/api/admin/analytics", { cache: "no-store" });
      const body = await request.json().catch(() => ({}));
      if (!request.ok) throw new Error(body.error ?? "Unable to load platform analytics.");
      setMetrics(body as UsageMetrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load platform analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [load]);

  if (!metrics && loading) return <AnalyticsLoadingSkeleton />;

  return (
    <PageShell className="gl-page-stack" size="xl">
      <PageHeader
        eyebrow="Private admin view"
        title="Platform usage"
        description="A privacy-conscious view of account growth and authenticated product activity. Live means seen within the last five minutes."
        action={<Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</Button>}
      />

      {error && !metrics ? (
        <DataLoadAlert
          title="Platform usage is temporarily unavailable"
          message="No usage totals are shown until the authenticated metrics can be verified."
          onRetry={() => void load()}
        />
      ) : error ? <p className="gl-auth-alert gl-auth-alert-error" role="alert">{error}</p> : null}

      {metrics ? (
        <>
          <section className="gl-usage-grid" aria-label="Platform usage summary">
            <Metric label="Using Gorilla Ledger now" value={metrics.live_users_5m} detail="Active in the last 5 minutes" live />
            <Metric label="Total users" value={metrics.total_users} detail="Registered accounts" />
            <Metric label="New users" value={metrics.new_users_7d} detail={`${number.format(metrics.new_users_24h)} in 24 hours · ${number.format(metrics.new_users_30d)} in 30 days`} />
            <Metric label="30-day active" value={metrics.active_users_30d} detail={`${number.format(metrics.active_users_24h)} in 24 hours · ${number.format(metrics.active_users_7d)} in 7 days`} />
            <Metric label="Returning users" value={metrics.returning_users_30d} detail="Active this month and created earlier" />
          </section>

          <Card variant="premium">
            <CardHeader>
              <div><p className="gl-page-eyebrow">Last 14 days</p><h2 className="text-lg font-semibold text-white">Growth and activity</h2></div>
              <time className="text-xs text-gray-500" dateTime={metrics.generated_at}>Updated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(metrics.generated_at))}</time>
            </CardHeader>
            <CardBody>
              <div className="gl-usage-table-wrap">
                <table className="gl-usage-table">
                  <thead><tr><th>Date</th><th>New users</th><th>Active users</th></tr></thead>
                  <tbody>{metrics.daily.map((point) => <tr key={point.date}><td><time dateTime={point.date}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${point.date}T12:00:00Z`))}</time></td><td>{number.format(point.new_users)}</td><td>{number.format(point.active_users)}</td></tr>)}</tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <p className="text-xs leading-5 text-gray-500">Counts include authenticated accounts only. No financial data, page names, IP addresses, or device fingerprints are collected for this view.</p>
        </>
      ) : null}
    </PageShell>
  );
}
