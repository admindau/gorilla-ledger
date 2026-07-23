"use client";

import { useState } from "react";
import ReceiptList from "@/components/receipts/ReceiptList";
import { formatOccurredAt, type OccurredAtPrecision } from "@/lib/time/ledgerTime";

type Wallet = {
  id: string;
  name: string;
  currency_code: string;
};

type CategoryType = "income" | "expense";

type Category = {
  id: string;
  name: string;
  type: CategoryType;
};

type TransactionType = "income" | "expense";

type Transaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
  occurred_at_precision?: OccurredAtPrecision | null;
  occurred_timezone?: string | null;
  description: string | null;
  created_at: string;
  transaction_kind?: string | null;
  transfer_id?: string | null;
};

type TransactionActivityCardProps = {
  tx: Transaction;
  wallet?: Wallet;
  category?: Category | null;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
};

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TransactionActivityCard({
  tx,
  wallet,
  category,
  onEdit,
  onDelete,
}: TransactionActivityCardProps) {
  const [showActions, setShowActions] = useState(false);
  const isIncome = tx.type === "income";
  const title = category?.name ?? "Uncategorized";
  const occurredAt = formatOccurredAt(
    tx.occurred_at,
    tx.occurred_at_precision === "datetime" ? "datetime" : "date",
    tx.occurred_timezone
  );

  return (
    <article className="gl-premium-card p-4 transition-all hover:border-white/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm",
                isIncome
                  ? "border-green-400/30 bg-green-400/10 text-green-300"
                  : "border-red-400/30 bg-red-400/10 text-red-300",
              ].join(" ")}
              aria-hidden="true"
            >
              {isIncome ? "+" : "−"}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
              {tx.type} • {wallet?.name ?? "Unknown wallet"} · {wallet?.currency_code ?? tx.currency_code}
              </p>
            </div>
          </div>

          {tx.description ? (
            <p className="mt-3 text-sm text-gray-300">{tx.description}</p>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No description added.</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            {tx.transfer_id ? (
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-blue-200">
                {tx.transaction_kind === "fx" ? "Paired FX" : "Paired transfer"}
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              {occurredAt.date}{occurredAt.time ? ` · ${occurredAt.time}` : " · Time not recorded"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              {tx.currency_code}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div
            className={[
              "text-lg font-semibold tracking-tight",
              isIncome ? "text-green-300" : "text-red-300",
            ].join(" ")}
          >
            {isIncome ? "+" : "-"}
            {formatMinorToAmount(tx.amount_minor)} {tx.currency_code}
          </div>

          <button
            type="button"
            onClick={() => setShowActions((value) => !value)}
            className="gl-btn gl-btn-secondary gl-btn-sm"
            aria-expanded={showActions}
            aria-label={`${showActions ? "Close actions for" : "Manage"} ${title} transaction from ${occurredAt.date}`}
          >
            {showActions ? "Close" : "Manage"}
          </button>
        </div>
      </div>

      {showActions ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="mb-3 flex flex-wrap justify-end gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => onEdit(tx)}
              className="gl-btn gl-btn-secondary gl-btn-sm"
            >
              Edit transaction
            </button>
            <button
              type="button"
              onClick={() => onDelete(tx)}
              className="gl-btn gl-btn-danger gl-btn-sm"
            >
              Delete
            </button>
          </div>
          <ReceiptList transactionId={tx.id} />
        </div>
      ) : null}
    </article>
  );
}
