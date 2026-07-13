"use client";

import type {
  CurrencyInsight,
  DashboardInsightModel,
  IntelligenceSeverity,
} from "@/lib/dashboard/intelligence";

type SmartInsightsPanelProps = {
  model: DashboardInsightModel;
};

function formatMoney(amountMinor: number, currencyCode: string): string {
  return `${new Intl.NumberFormat("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)} ${currencyCode}`;
}

function severityTone(severity: IntelligenceSeverity): string {
  if (severity === "critical") return "border-white/25 bg-white/[0.09] text-white";
  if (severity === "warning") return "border-white/20 bg-white/[0.06] text-gray-100";
  if (severity === "success") return "border-white/10 bg-white/[0.035] text-gray-300";
  return "border-white/[0.08] bg-black/20 text-gray-400";
}

function CurrencySignals({ currency }: { currency: CurrencyInsight }) {
  const primaryAlert = currency.alerts[0] ?? null;
  const recommendation = currency.recommendations[0] ?? null;

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-gray-200">
          {currency.currencyCode}
        </span>
        <span className="text-[10px] text-gray-500">
          {currency.transactionCount} {currency.transactionCount === 1 ? "transaction" : "transactions"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
          <p className="text-[8px] uppercase tracking-[0.14em] text-gray-500">Income</p>
          <p className="mt-1 break-words text-[11px] font-semibold text-gray-200">
            {formatMoney(currency.incomeMinor, currency.currencyCode)}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
          <p className="text-[8px] uppercase tracking-[0.14em] text-gray-500">Expenses</p>
          <p className="mt-1 break-words text-[11px] font-semibold text-gray-200">
            {formatMoney(currency.expenseMinor, currency.currencyCode)}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
          <p className="text-[8px] uppercase tracking-[0.14em] text-gray-500">Net</p>
          <p className="mt-1 break-words text-[11px] font-semibold text-gray-200">
            {formatMoney(currency.netMinor, currency.currencyCode)}
          </p>
        </div>
      </div>

      {primaryAlert ? (
        <div className={`mt-3 rounded-xl border p-3 ${severityTone(primaryAlert.severity)}`}>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70">Priority signal</p>
          <p className="mt-1 text-xs font-semibold">{primaryAlert.title}</p>
          <p className="mt-1 text-[10px] leading-4 opacity-80">{primaryAlert.message}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-xs font-medium text-gray-300">No material warning detected</p>
          <p className="mt-1 text-[10px] leading-4 text-gray-500">
            Cash flow and scored budgets do not currently require attention.
          </p>
        </div>
      )}

      {recommendation && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-500">Next action</p>
          <p className="mt-1 text-xs font-semibold text-gray-200">{recommendation.title}</p>
          <p className="mt-1 text-[10px] leading-4 text-gray-500">{recommendation.rationale}</p>
        </div>
      )}
    </article>
  );
}

export default function SmartInsightsPanel({ model }: SmartInsightsPanelProps) {
  const activeCurrencies = model.currencies.filter(
    (currency) => currency.health.hasActivity || currency.alerts.length > 0
  );
  const globalAlerts = model.alerts.filter((alert) => alert.currencyCode === "GLOBAL");

  return (
    <section aria-labelledby="smart-insights-title" className="flex h-full min-h-[22rem] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">Pattern intelligence</span>
          <h3 id="smart-insights-title" className="mt-2 text-base font-semibold tracking-tight text-white">Smart Insights</h3>
          <p className="mt-1 text-[11px] leading-5 text-gray-400">
            Model-driven signals with currencies kept fully separate.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          Certified
        </span>
      </div>

      {activeCurrencies.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {activeCurrencies.map((currency) => (
            <CurrencySignals key={currency.currencyCode} currency={currency} />
          ))}
          {globalAlerts.map((alert) => (
            <div key={alert.id} className={`rounded-xl border p-3 ${severityTone(alert.severity)}`}>
              <p className="text-xs font-semibold">{alert.title}</p>
              <p className="mt-1 text-[10px] leading-4 opacity-80">{alert.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/15 p-6 text-center">
          <div>
            <p className="text-sm font-medium text-gray-300">No smart signals yet</p>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              Add transactions to activate multi-currency intelligence.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
