"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Line,
  ReferenceDot,
} from "recharts";

type TransactionType = "income" | "expense" | "transfer";

type Transaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

type Props = {
  transactions: Transaction[];
  categories: Category[];
  targetYear: number;
  walletFilter: string; // "all" or wallet_id
};

type ChartRow = {
  monthIndex0: number;
  month: string;
  income: number;
  expense: number;
  net: number;
};

function isInternalTransferCategory(category?: Category | null): boolean {
  if (!category) return false;
  const n = category.name.toLowerCase().trim();
  return n.startsWith("transfer");
}

function monthLabelShort(monthIndex0: number): string {
  const d = new Date(2000, monthIndex0, 1);
  return d.toLocaleString("en", { month: "short" });
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function calcSavingsRate(income: number, net: number): string {
  if (income <= 0) return "—";
  const pct = (net / income) * 100;
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(0)}%`;
}

function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  currency: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // payload entries contain the plotted keys; we want income/expense/net if present
  const byKey: Record<string, number> = {};
  for (const p of payload) {
    if (!p?.dataKey) continue;
    const v = typeof p.value === "number" ? p.value : Number(p.value);
    if (Number.isFinite(v)) byKey[p.dataKey] = v;
  }

  const income = byKey.income ?? 0;
  const expense = byKey.expense ?? 0;
  const net = byKey.net ?? income - expense;

  const ccy = currency ? ` ${currency}` : "";

  return (
    <div className="rounded-lg border border-gray-700 bg-black/90 px-3 py-2 text-[11px] text-gray-100 shadow">
      <div className="mb-1 text-gray-200 font-medium">{label}</div>

      <div className="flex items-center justify-between gap-6">
        <span className="text-gray-300">Income</span>
        <span className="text-white">{formatNumber(income)}{ccy}</span>
      </div>

      <div className="flex items-center justify-between gap-6">
        <span className="text-gray-300">Expenses</span>
        <span className="text-white">{formatNumber(expense)}{ccy}</span>
      </div>

      <div className="my-1 h-px bg-gray-800" />

      <div className="flex items-center justify-between gap-6">
        <span className="text-gray-300">Net</span>
        <span className="text-white">{formatNumber(net)}{ccy}</span>
      </div>

      <div className="flex items-center justify-between gap-6">
        <span className="text-gray-300">Savings rate</span>
        <span className="text-white">{calcSavingsRate(income, net)}</span>
      </div>
    </div>
  );
}

export default function YearlyIncomeExpenseBarChart({
  transactions,
  categories,
  targetYear,
  walletFilter,
}: Props) {
  const categoryMap = useMemo(() => {
    return Object.fromEntries(categories.map((c) => [c.id, c] as const));
  }, [categories]);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      if (tx.currency_code) set.add(tx.currency_code);
    }
    return Array.from(set).sort();
  }, [transactions]);

  const hasCurrencyInfo = currencies.length > 0;

  const [activeCurrency, setActiveCurrency] = useState<string | null>(
    hasCurrencyInfo ? currencies[0] : null
  );

  // Keep activeCurrency valid if currencies change
  useEffect(() => {
    if (!hasCurrencyInfo) {
      if (activeCurrency !== null) setActiveCurrency(null);
      return;
    }
    if (!activeCurrency || !currencies.includes(activeCurrency)) {
      setActiveCurrency(currencies[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCurrencyInfo, currencies.join("|")]);

  const chartData: ChartRow[] = useMemo(() => {
    const base: ChartRow[] = Array.from({ length: 12 }).map((_, i) => ({
      monthIndex0: i,
      month: monthLabelShort(i),
      income: 0,
      expense: 0,
      net: 0,
    }));

    const filtered = transactions.filter((tx) => {
      if (walletFilter !== "all" && tx.wallet_id !== walletFilter) return false;

      const d = new Date(tx.occurred_at);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getFullYear() !== targetYear) return false;

      if (hasCurrencyInfo && activeCurrency) {
        if (tx.currency_code !== activeCurrency) return false;
      }

      const cat = tx.category_id ? categoryMap[tx.category_id] : null;
      if (isInternalTransferCategory(cat)) return false;

      return true;
    });

    for (const tx of filtered) {
      const d = new Date(tx.occurred_at);
      if (Number.isNaN(d.getTime())) continue;
      const m = d.getMonth();
      if (m < 0 || m > 11) continue;

      const amount = tx.amount_minor / 100;

      if (tx.type === "income") base[m].income += amount;
      if (tx.type === "expense") base[m].expense += amount;
    }

    for (const row of base) {
      row.net = row.income - row.expense;
    }

    return base;
  }, [
    transactions,
    walletFilter,
    targetYear,
    categoryMap,
    hasCurrencyInfo,
    activeCurrency,
  ]);

  const hasAnyActivity = useMemo(() => {
    return chartData.some((m) => m.income !== 0 || m.expense !== 0);
  }, [chartData]);

  const peaks = useMemo(() => {
    let maxIncome = -Infinity;
    let maxIncomeMonth: string | null = null;

    let maxExpense = -Infinity;
    let maxExpenseMonth: string | null = null;

    for (const row of chartData) {
      if (row.income > maxIncome) {
        maxIncome = row.income;
        maxIncomeMonth = row.month;
      }
      if (row.expense > maxExpense) {
        maxExpense = row.expense;
        maxExpenseMonth = row.month;
      }
    }

    return {
      maxIncome,
      maxIncomeMonth,
      maxExpense,
      maxExpenseMonth,
    };
  }, [chartData]);

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold">Calendar Year Income vs Expenses</h2>
          <p className="text-xs text-gray-400">
            Monthly totals for {targetYear}. Hover a month to see income, expenses,
            net, and savings rate.
          </p>
        </div>

        {hasCurrencyInfo && (
          <div className="inline-flex rounded-full border border-gray-800 bg-black/60 p-0.5 text-[11px]">
            {currencies.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setActiveCurrency(code)}
                className={`px-2 py-0.5 rounded-full ${
                  activeCurrency === code
                    ? "bg-white text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasAnyActivity ? (
        <p className="text-xs text-gray-500">
          No income/expense activity found for {targetYear} (based on current filters).
        </p>
      ) : (
        <div className="border border-gray-800 rounded-lg bg-black/40 p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap={18}
              barGap={6}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              {/* Patterns for monochrome differentiation */}
              <defs>
                <pattern
                  id="expenseHatch"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="2" />
                </pattern>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#222222" />

              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#374151" }}
                tickLine={{ stroke: "#374151" }}
              />

              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#374151" }}
                tickLine={{ stroke: "#374151" }}
                tickFormatter={(v) => compactNumber(Number(v))}
              />

              <Tooltip
                content={
                  <CustomTooltip currency={hasCurrencyInfo ? activeCurrency : null} />
                }
              />

              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  color: "#d1d5db",
                }}
              />

              {/* Expenses: hatched (white-only), Income: solid white */}
              <Bar
                dataKey="expense"
                name="Expenses"
                fill="url(#expenseHatch)"
                stroke="#ffffff"
                strokeWidth={1}
                opacity={0.9}
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill="#ffffff"
                opacity={0.95}
                radius={[6, 6, 0, 0]}
              />

              {/* Net overlay line (dashed) */}
              <Line
                type="monotone"
                dataKey="net"
                name="Net"
                stroke="#ffffff"
                strokeWidth={2}
                dot={false}
                strokeDasharray="6 6"
                opacity={0.9}
              />

              {/* Peak markers */}
              {peaks.maxIncomeMonth && peaks.maxIncome > 0 && (
                <ReferenceDot
                  x={peaks.maxIncomeMonth}
                  y={peaks.maxIncome}
                  r={5}
                  fill="#ffffff"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
              )}
              {peaks.maxExpenseMonth && peaks.maxExpense > 0 && (
                <ReferenceDot
                  x={peaks.maxExpenseMonth}
                  y={peaks.maxExpense}
                  r={5}
                  fill="#000000"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
