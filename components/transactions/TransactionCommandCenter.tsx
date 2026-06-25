"use client";

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
};

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatSignedAmount(amountMinor: number, currencyCode: string, sign = ""): string {
  return `${sign}${formatMinorToAmount(amountMinor)} ${currencyCode}`;
}

export function TransactionCommandCenter({ transactions }: TransactionCommandCenterProps) {
  const monthKey = currentMonthKey();
  const monthTransactions = transactions.filter((tx) => tx.occurred_at.slice(0, 7) === monthKey);
  const displayTransactions = monthTransactions.length > 0 ? monthTransactions : transactions;
  const primaryCurrency = displayTransactions[0]?.currency_code ?? transactions[0]?.currency_code ?? "SSP";

  const incomeMinor = displayTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount_minor, 0);

  const expenseMinor = displayTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount_minor, 0);

  const netMinor = incomeMinor - expenseMinor;
  const scopeLabel = monthTransactions.length > 0 ? "This month" : "Loaded records";

  const items = [
    {
      label: "Activity",
      value: String(displayTransactions.length),
      caption: scopeLabel,
    },
    {
      label: "Income",
      value: formatSignedAmount(incomeMinor, primaryCurrency, "+"),
      caption: scopeLabel,
      tone: "positive",
    },
    {
      label: "Expenses",
      value: formatSignedAmount(expenseMinor, primaryCurrency, "-"),
      caption: scopeLabel,
      tone: "negative",
    },
    {
      label: "Net Flow",
      value: formatSignedAmount(Math.abs(netMinor), primaryCurrency, netMinor >= 0 ? "+" : "-"),
      caption: netMinor >= 0 ? "Positive flow" : "Negative flow",
      tone: netMinor >= 0 ? "positive" : "negative",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="gl-premium-card p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{item.label}</p>
          <p
            className={[
              "mt-2 truncate text-2xl font-semibold tracking-tight",
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
