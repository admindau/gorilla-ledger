"use client";

import Link from "next/link";

import type {
  CurrencyInsight,
  DashboardInsightModel,
  IntelligenceActionTarget,
  IntelligenceRecommendationPriority,
} from "@/lib/dashboard/intelligence";

type AiInsightsSidebarProps = {
  model: DashboardInsightModel;
};

type CoachTone = "positive" | "attention" | "neutral";

function toneClasses(tone: CoachTone): string {
  if (tone === "positive") return "border-white/10 bg-white/[0.035] text-gray-200";
  if (tone === "attention") return "border-white/20 bg-white/[0.07] text-white";
  return "border-white/[0.08] bg-black/20 text-gray-300";
}

function recommendationTone(priority: IntelligenceRecommendationPriority): CoachTone {
  return priority === "urgent" || priority === "high"
    ? "attention"
    : priority === "low"
      ? "positive"
      : "neutral";
}

function actionHref(target: IntelligenceActionTarget): string {
  switch (target) {
    case "wallets":
      return "/wallets";
    case "transactions":
      return "/transactions";
    case "budgets":
      return "/budgets";
    case "recurring":
      return "/recurring";
    case "categories":
      return "/categories";
    case "settings":
      return "/settings";
    default:
      return "/dashboard";
  }
}

function SignalIcon({ tone }: { tone: CoachTone }) {
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${toneClasses(tone)}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {tone === "positive" ? <path d="M5 12.5l4 4L19 6.5" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>}
      </svg>
    </span>
  );
}

function CurrencyCoach({ currency }: { currency: CurrencyInsight }) {
  const recommendation = currency.recommendations[0];
  const tone = recommendation ? recommendationTone(recommendation.priority) : "positive";
  const title = recommendation?.title ?? `Maintain the ${currency.currencyCode} position`;
  const rationale = recommendation?.rationale ?? "No immediate cash-flow or budget pressure was detected.";
  const href = actionHref(recommendation?.actionTarget ?? "dashboard");
  const label = recommendation?.actionLabel ?? "View dashboard";

  return (
    <article className={`rounded-2xl border p-4 ${toneClasses(tone)}`}>
      <div className="flex items-start gap-3">
        <SignalIcon tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em]">
              {currency.currencyCode}
            </span>
            <span className="text-[9px] uppercase tracking-[0.13em] opacity-60">
              Score {currency.health.score}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1.5 text-[11px] leading-5 opacity-80">{rationale}</p>
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {label}
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 10h12M11 5l5 5-5 5" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function AiInsightsSidebar({ model }: AiInsightsSidebarProps) {
  const activeCurrencies = model.currencies.filter(
    (currency) => currency.health.hasActivity || currency.recommendations.length > 0
  );

  return (
    <aside aria-labelledby="ai-coach-title" className="flex h-full min-h-[22rem] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="gl-section-eyebrow">Decision support</span>
          <h2 id="ai-coach-title" className="mt-3 text-base font-semibold tracking-tight text-white">AI Coach</h2>
          <p className="mt-1 text-[11px] leading-5 text-gray-400">
            Prioritized actions generated from the certified intelligence model.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">
          Multi-currency
        </span>
      </div>

      {activeCurrencies.length > 0 ? (
        <div className="mt-5 space-y-3">
          {activeCurrencies.map((currency) => (
            <CurrencyCoach key={currency.currencyCode} currency={currency} />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/15 p-6 text-center">
          <div>
            <p className="text-sm font-medium text-gray-300">No coaching actions yet</p>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              Add financial activity to unlock currency-specific recommendations.
            </p>
          </div>
        </div>
      )}

      <details className="group mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-medium text-gray-400 marker:content-none">
          How this was calculated
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </summary>
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-5 text-gray-500">
          Recommendations use reconciled balances, cash flow, budget health, and forecasts. Every currency is evaluated independently; no currencies are combined or converted.
        </p>
      </details>
    </aside>
  );
}
