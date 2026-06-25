import type { ReactNode } from "react";
import { TransactionTimelineGroup } from "@/components/transactions/TransactionTimelineGroup";

type TimelineTransaction = {
  id: string;
  occurred_at: string;
};

type TransactionTimelineProps<T extends TimelineTransaction> = {
  transactions: T[];
  renderTransaction: (transaction: T) => ReactNode;
};

function dateKeyFromIso(isoDate: string): string {
  const value = isoDate?.slice(0, 10);
  return value || "Unknown date";
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTimelineLabel(dateKey: string): string {
  if (dateKey === "Unknown date") return dateKey;

  const [year, month, day] = dateKey.split("-").map(Number);
  const transactionDate = new Date(year, (month || 1) - 1, day || 1);
  const today = startOfLocalDay(new Date());
  const diffDays = Math.round(
    (today.getTime() - startOfLocalDay(transactionDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(transactionDate);
}

export function TransactionTimeline<T extends TimelineTransaction>({
  transactions,
  renderTransaction,
}: TransactionTimelineProps<T>) {
  const groups = transactions.reduce<Array<{ key: string; items: T[] }>>(
    (acc, transaction) => {
      const key = dateKeyFromIso(transaction.occurred_at);
      const existing = acc.find((group) => group.key === key);

      if (existing) {
        existing.items.push(transaction);
      } else {
        acc.push({ key, items: [transaction] });
      }

      return acc;
    },
    []
  );

  return (
    <div className="space-y-1 text-sm">
      {groups.map((group) => (
        <TransactionTimelineGroup
          key={group.key}
          label={formatTimelineLabel(group.key)}
          count={group.items.length}
        >
          {group.items.map((transaction) => renderTransaction(transaction))}
        </TransactionTimelineGroup>
      ))}
    </div>
  );
}
