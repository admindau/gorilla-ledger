"use client";

import { buildCurrencyFlows } from "@/lib/finance/currencyTotals";
import { MetricGridState, type DataState } from "@/components/ui/MetricGridState";

type TransactionType = "income" | "expense";

type Transaction = {
  id: string;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

type TransactionCommandCenterProps = {
  transactions: Transaction[];
  dataState?: DataState;
  scopeLabel?: string;
};

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

function formatSignedAmount(amountMinor: number, currencyCode: string, sign = ""): string {
  return `${sign}${formatMinorToAmount(amountMinor)} ${currencyCode}`;
}

function MoneyLines({
  flows,
  field,
}: {
  flows: ReturnType<typeof buildCurrencyFlows>;
  field: "incomeMinor" | "expenseMinor" | "netMinor";
}) {
  if (flows.length === 0) return <span>—</span>;

  return (
    <span className="flex flex-col gap-1">
      {flows.map((flow) => {
        const value = flow[field];
        const sign = field === "expenseMinor" ? "-" : value >= 0 ? "+" : "-";
        return (
          <span key={flow.currencyCode}>
            {formatSignedAmount(Math.abs(value), flow.currencyCode, sign)}
          </span>
        );
      })}
    </span>
  );
}

export function TransactionCommandCenter({
  transactions,
  dataState = "ready",
  scopeLabel = "This month",
}: TransactionCommandCenterProps) {
  if (dataState !== "ready") return <MetricGridState state={dataState} />;

  const flows = buildCurrencyFlows(transactions);

  const items = [
    {
      label: "Activity",
      value: String(transactions.length),
      caption: scopeLabel,
    },
    {
      label: "Income",
      value: <MoneyLines flows={flows} field="incomeMinor" />,
      caption: scopeLabel,
      tone: "positive",
    },
    {
      label: "Expenses",
      value: <MoneyLines flows={flows} field="expenseMinor" />,
      caption: scopeLabel,
      tone: "negative",
    },
    {
      label: "Net Flow",
      value: <MoneyLines flows={flows} field="netMinor" />,
      caption: flows.length > 1 ? "Separated by currency" : "Income minus expenses",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="gl-premium-card p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{item.label}</p>
          <p
            className={[
              "mt-2 text-xl font-semibold tracking-tight",
              item.tone === "positive" ? "text-green-300" : "",
              item.tone === "negative" ? "text-red-300" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.value}
          </p>
          <p className="mt-1 text-xs text-gray-500">{item.caption}</p>
        </div>
      ))}
    </section>
  );
}
