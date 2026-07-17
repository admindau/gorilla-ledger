"use client";

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

export type BudgetCardSummary = {
  id: string;
  amountMinor: number;
  actualMinor: number;
  remainingMinor: number;
  usedRatio: number;
  wallet?: Wallet | null;
  category?: Category | null;
  year: number;
  month: number;
};

type BudgetCardProps = {
  summary: BudgetCardSummary;
  isEditing: boolean;
  isBusy: boolean;
  editAmount: string;
  onEditAmountChange: (value: string) => void;
  onBeginEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
};

function formatMinor(minor: number): string {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusForRatio(ratio: number) {
  if (ratio > 1) {
    return {
      label: "Over budget",
      helper: "Spending has exceeded this budget.",
      className: "border-red-400/30 bg-red-400/10 text-red-200",
      barClassName: "bg-red-300",
    };
  }

  if (ratio >= 0.8) {
    return {
      label: "At risk",
      helper: "Spending is approaching the monthly limit.",
      className: "border-yellow-300/30 bg-yellow-300/10 text-yellow-100",
      barClassName: "bg-yellow-200",
    };
  }

  return {
    label: "Healthy",
    helper: "Budget is currently under control.",
    className: "border-green-300/30 bg-green-300/10 text-green-200",
    barClassName: "bg-white",
  };
}

export function BudgetCard({
  summary,
  isEditing,
  isBusy,
  editAmount,
  onEditAmountChange,
  onBeginEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: BudgetCardProps) {
  const currency = summary.wallet?.currency_code ?? "";
  const status = statusForRatio(summary.usedRatio);
  const usedPercent = Math.round(summary.usedRatio * 100);
  const barPercent = Math.max(0, Math.min(usedPercent, 100));
  const period = `${summary.year}-${String(summary.month).padStart(2, "0")}`;

  return (
    <article className="gl-premium-card p-4 transition-all hover:border-white/20">
      {!isEditing ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm">
                  ◌
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-white">
                    {summary.category?.name ?? "Unknown category"}
                  </h3>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                    {summary.wallet?.name ?? "All wallets"} {currency ? `• ${currency}` : ""} • {period}
                  </p>
                </div>
              </div>
            </div>

            <span
              className={[
                "w-fit rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
                status.className,
              ].join(" ")}
              title={status.helper}
            >
              {status.label}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Allocated</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatMinor(summary.amountMinor)} {currency}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Spent</p>
              <p className="mt-1 text-lg font-semibold text-gray-200">
                {formatMinor(summary.actualMinor)} {currency}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Remaining</p>
              <p
                className={[
                  "mt-1 text-lg font-semibold",
                  summary.remainingMinor < 0 ? "text-red-300" : "text-green-300",
                ].join(" ")}
              >
                {formatMinor(summary.remainingMinor)} {currency}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>{usedPercent}% used</span>
              <span>{status.helper}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={["h-full rounded-full", status.barClassName].join(" ")} style={{ width: `${barPercent}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={onBeginEdit}
              disabled={isBusy}
              className="gl-btn gl-btn-secondary gl-btn-sm"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isBusy}
              className="gl-btn gl-btn-danger gl-btn-sm"
            >
              {isBusy ? "Working..." : "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <div className="md:col-span-2">
            <div className="mb-2 text-xs text-gray-400">
              {summary.category?.name ?? "Unknown category"} • {summary.wallet?.name ?? "All wallets"}{" "}
              {currency ? `• ${currency}` : ""}
            </div>
            <label htmlFor={`budget-amount-${summary.id}`} className="mb-1 block text-xs text-gray-400">Budget amount</label>
            <input
              id={`budget-amount-${summary.id}`}
              type="text"
              className="gl-input"
              value={editAmount}
              onChange={(event) => onEditAmountChange(event.target.value)}
            />
          </div>

          <div className="flex gap-2 md:justify-end">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={isBusy}
              className="gl-btn gl-btn-primary gl-btn-sm"
            >
              {isBusy ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isBusy}
              className="gl-btn gl-btn-secondary gl-btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
