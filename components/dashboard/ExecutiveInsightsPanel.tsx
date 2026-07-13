import type {
  CurrencyInsight,
  DashboardInsightModel,
  IntelligenceRiskLevel,
} from "@/lib/dashboard/intelligence";

type ExecutiveInsightsPanelProps = {
  model: DashboardInsightModel;
};

function formatMoney(amountMinor: number, currencyCode: string): string {
  return `${new Intl.NumberFormat("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)} ${currencyCode}`;
}

function riskLabel(level: IntelligenceRiskLevel): string {
  return level === "healthy"
    ? "Healthy"
    : level === "critical"
      ? "Critical"
      : level === "warning"
        ? "Warning"
        : "Watch";
}

function riskTone(level: IntelligenceRiskLevel): string {
  if (level === "critical") return "border-white/25 bg-white/[0.09] text-white";
  if (level === "warning") return "border-white/20 bg-white/[0.065] text-gray-100";
  if (level === "watch") return "border-white/15 bg-white/[0.045] text-gray-200";
  return "border-white/10 bg-white/[0.03] text-gray-300";
}

function CurrencyBrief({ currency }: { currency: CurrencyInsight }) {
  const largestExpense = currency.largestExpense;
  const largestIncome = currency.largestIncome;

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-gray-200">
          {currency.currencyCode}
        </span>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] ${riskTone(currency.health.riskLevel)}`}>
          {riskLabel(currency.health.riskLevel)} · {currency.health.score}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-gray-500">Net flow</p>
          <p className="mt-1 break-words text-sm font-semibold text-white">
            {formatMoney(currency.netMinor, currency.currencyCode)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-gray-500">Balance</p>
          <p className="mt-1 break-words text-sm font-semibold text-white">
            {formatMoney(currency.balanceMinor, currency.currencyCode)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
        <div className="flex items-start justify-between gap-3 text-[11px]">
          <span className="text-gray-500">Largest income</span>
          <span className="max-w-[65%] text-right font-medium text-gray-200">
            {largestIncome
              ? `${largestIncome.categoryName ?? "Uncategorized"} · ${formatMoney(largestIncome.amountMinor, currency.currencyCode)}`
              : "No income recorded"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 text-[11px]">
          <span className="text-gray-500">Largest expense</span>
          <span className="max-w-[65%] text-right font-medium text-gray-200">
            {largestExpense
              ? `${largestExpense.categoryName ?? "Uncategorized"} · ${formatMoney(largestExpense.amountMinor, currency.currencyCode)}`
              : "No expense recorded"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 text-[11px]">
          <span className="text-gray-500">Budgets</span>
          <span className="max-w-[65%] text-right font-medium text-gray-200">
            {currency.budget.total > 0
              ? `${currency.budget.healthy} healthy · ${currency.budget.atRisk} at risk · ${currency.budget.over} over`
              : "No scored budgets"}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function ExecutiveInsightsPanel({ model }: ExecutiveInsightsPanelProps) {
  const activeCurrencies = model.currencies.filter(
    (currency) => currency.health.hasActivity || currency.forecast.scheduledOccurrencesCount > 0
  );

  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">Decision brief</span>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-white">Executive Insights</h3>
          <p className="mt-1 text-[11px] leading-5 text-gray-400">
            Certified financial signals for each active currency.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          {activeCurrencies.length} {activeCurrencies.length === 1 ? "currency" : "currencies"}
        </span>
      </div>

      {activeCurrencies.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {activeCurrencies.map((currency) => (
            <CurrencyBrief key={currency.currencyCode} currency={currency} />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/15 p-6 text-center">
          <div>
            <div className="mx-auto h-8 w-8 rounded-full border border-white/10 bg-white/[0.035]" />
            <p className="mt-3 text-sm font-medium text-gray-300">No executive signals yet</p>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              Insights will appear when financial activity is available.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
