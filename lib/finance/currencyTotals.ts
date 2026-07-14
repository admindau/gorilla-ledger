export type CurrencyAmount = {
  currencyCode: string;
  amountMinor: number;
};

export type CurrencyFlow = {
  currencyCode: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  transactionCount: number;
};

type FlowTransaction = {
  type: "income" | "expense";
  amount_minor: number;
  currency_code: string;
};

export function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

export function buildCurrencyFlows(transactions: FlowTransaction[]): CurrencyFlow[] {
  const totals = new Map<string, CurrencyFlow>();

  for (const transaction of transactions) {
    const currencyCode = normalizeCurrencyCode(transaction.currency_code);
    if (!currencyCode || !Number.isSafeInteger(transaction.amount_minor)) continue;

    const current = totals.get(currencyCode) ?? {
      currencyCode,
      incomeMinor: 0,
      expenseMinor: 0,
      netMinor: 0,
      transactionCount: 0,
    };

    if (transaction.type === "income") current.incomeMinor += transaction.amount_minor;
    if (transaction.type === "expense") current.expenseMinor += transaction.amount_minor;
    current.netMinor = current.incomeMinor - current.expenseMinor;
    current.transactionCount += 1;
    totals.set(currencyCode, current);
  }

  return Array.from(totals.values()).sort((a, b) =>
    a.currencyCode.localeCompare(b.currencyCode)
  );
}

export function sumCurrencyAmounts(amounts: CurrencyAmount[]): CurrencyAmount[] {
  const totals = new Map<string, number>();

  for (const amount of amounts) {
    const currencyCode = normalizeCurrencyCode(amount.currencyCode);
    if (!currencyCode || !Number.isSafeInteger(amount.amountMinor)) continue;
    totals.set(currencyCode, (totals.get(currencyCode) ?? 0) + amount.amountMinor);
  }

  return Array.from(totals, ([currencyCode, amountMinor]) => ({
    currencyCode,
    amountMinor,
  })).sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}
