"use client";

import Link from "next/link";
import {
  buildMonthlyReviewCsv,
  type MonthlyReviewCurrency,
  type MonthlyReviewModel,
} from "@/lib/retention/monthlyReview";

type MonthlyReviewProps = {
  model: MonthlyReviewModel;
};

function formatMinor(minor: number) {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function changeLabel(entry: MonthlyReviewCurrency) {
  if (!entry.previous.transactionCount) return "First comparison month";
  if (entry.expenseChangePercent === null) return "No prior expense baseline";
  if (entry.expenseTrend === "flat") return "Expenses broadly stable";
  const direction = entry.expenseChangePercent > 0 ? "higher" : "lower";
  return `Expenses ${Math.abs(entry.expenseChangePercent)}% ${direction}`;
}

function trendClasses(entry: MonthlyReviewCurrency) {
  if (entry.expenseTrend === "up") return "border-amber-400/25 bg-amber-400/[0.07] text-amber-200";
  if (entry.expenseTrend === "down") return "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200";
  return "border-white/10 bg-white/[0.035] text-gray-300";
}

export function MonthlyReview({ model }: MonthlyReviewProps) {
  const actionTone =
    model.primaryAction.tone === "watch"
      ? "border-amber-400/25 bg-amber-400/[0.07]"
      : model.primaryAction.tone === "positive"
        ? "border-emerald-400/25 bg-emerald-400/[0.07]"
        : "border-white/10 bg-white/[0.035]";

  function exportReview() {
    const csv = buildMonthlyReviewCsv(model);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gorilla-ledger-${model.selectedLabel.toLowerCase().replaceAll(" ", "-")}-review.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="mb-9 sm:mb-10" aria-labelledby="monthly-review-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="gl-section-eyebrow">Monthly return loop</span>
          <h2 id="monthly-review-title" className="mt-3 text-xl font-semibold tracking-tight">
            Monthly Review — {model.selectedLabel}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Compared with {model.previousLabel}. Monetary movement remains separated by currency.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
            {model.currentTransactionCount} current · {model.previousTransactionCount} prior
          </div>
          <button
            type="button"
            className="gl-btn gl-btn-secondary gl-btn-sm"
            onClick={exportReview}
            disabled={model.entries.length === 0}
          >
            Export review
          </button>
        </div>
      </div>

      {model.entries.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {model.entries.map((entry) => (
            <article key={entry.currencyCode} className="gl-premium-card p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-[0.18em] text-white">{entry.currencyCode}</span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${trendClasses(entry)}`}>
                  {changeLabel(entry)}
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Income</dt>
                  <dd className="mt-2 text-sm font-semibold tabular-nums text-emerald-200">{formatMinor(entry.current.incomeMinor)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Expense</dt>
                  <dd className="mt-2 text-sm font-semibold tabular-nums text-red-200">{formatMinor(entry.current.expenseMinor)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Net</dt>
                  <dd className={`mt-2 text-sm font-semibold tabular-nums ${entry.current.netMinor < 0 ? "text-red-200" : "text-white"}`}>
                    {formatMinor(entry.current.netMinor)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-white/10 pt-3 text-xs text-gray-500">
                Net change vs prior month: <span className="font-medium text-gray-300">{entry.netChangeMinor >= 0 ? "+" : ""}{formatMinor(entry.netChangeMinor)} {entry.currencyCode}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="gl-empty-state rounded-2xl p-6 text-sm text-gray-400">
          No activity is available for either comparison month yet.
        </div>
      )}

      <div className={`mt-4 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${actionTone}`}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Recommended follow-up</p>
          <h3 className="mt-2 text-base font-semibold text-white">{model.primaryAction.label}</h3>
          <p className="mt-1 text-sm text-gray-400">{model.primaryAction.description}</p>
        </div>
        <Link href={model.primaryAction.href} className="gl-btn gl-btn-secondary gl-btn-md shrink-0">
          {model.primaryAction.actionLabel}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
