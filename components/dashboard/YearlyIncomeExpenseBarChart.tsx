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

function isInternalTransferCategory(category?: Category | null): boolean {
  if (!category) return false;
  const n = category.name.toLowerCase().trim();
  return n.startsWith("transfer");
}

function monthLabelShort(monthIndex0: number): string {
  // monthIndex0: 0..11
  const d = new Date(2000, monthIndex0, 1);
  return d.toLocaleString("en", { month: "short" });
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

  // Keep activeCurrency valid if currencies change due to filters/data
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

  const chartData = useMemo(() => {
    // Build 12 months, calendar-year scoped
    const base = Array.from({ length: 12 }).map((_, i) => ({
      monthIndex0: i,
      month: monthLabelShort(i),
      income: 0,
      expense: 0,
    }));

    const filtered = transactions.filter((tx) => {
      // Wallet filter
      if (walletFilter !== "all" && tx.wallet_id !== walletFilter) return false;

      // Year scope (calendar year)
      const d = new Date(tx.occurred_at);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getFullYear() !== targetYear) return false;

      // Currency focus (if metadata exists)
      if (hasCurrencyInfo && activeCurrency) {
        if (tx.currency_code !== activeCurrency) return false;
      }

      // Exclude internal transfer categories (consistent with analytics)
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
      // tx.type === "transfer" ignored implicitly here
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

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold">
            Calendar Year Income vs Expenses
          </h2>
          <p className="text-xs text-gray-400">
            Monthly totals for {targetYear}. Use this to spot your highest-income
            and highest-expense months at a glance.
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
          No income/expense activity found for {targetYear} (based on current
          filters).
        </p>
      ) : (
        <div className="border border-gray-800 rounded-lg bg-black/40 p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
                tickFormatter={(v) => Number(v).toLocaleString()}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.9)",
                  border: "1px solid #374151",
                  borderRadius: "0.5rem",
                  fontSize: 11,
                  color: "#f9fafb",
                }}
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#f9fafb" }}
                formatter={(value: number | string, name: string) => {
                  const num = typeof value === "number" ? value : Number(value);
                  if (!Number.isNaN(num)) return [formatNumber(num), name];
                  return [value, name];
                }}
              />

              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  color: "#d1d5db",
                }}
              />

              {/* Black/white palette compliance */}
              <Bar
                dataKey="expense"
                name="Expenses"
                fill="#ffffff"
                opacity={0.55}
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill="#ffffff"
                opacity={0.95}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
