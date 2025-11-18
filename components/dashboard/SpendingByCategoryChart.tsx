"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

type TransactionType = "income" | "expense";

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
  selectedYear: number;
  selectedMonth: number; // 0-based
  walletFilter: string; // "all" or wallet id
  categoryFilter: string; // "all" or category id
};

function isInternalTransferCategory(category?: Category | null): boolean {
  if (!category) return false;
  const n = category.name.toLowerCase().trim();
  return n.startsWith("transfer");
}

const COLORS = [
  "#facc15",
  "#f97373",
  "#38bdf8",
  "#4ade80",
  "#e879f9",
  "#fb923c",
  "#22c55e",
];

export default function SpendingByCategoryChart({
  transactions,
  categories,
  selectedYear,
  selectedMonth,
  walletFilter,
  categoryFilter,
}: Props) {
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c] as const)),
    [categories]
  );

  const expensesByCurrency = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};

    for (const tx of transactions) {
      const d = new Date(tx.occurred_at);
      if (Number.isNaN(d.getTime())) continue;

      if (d.getFullYear() !== selectedYear || d.getMonth() !== selectedMonth) {
        continue;
      }

      if (tx.type !== "expense") continue;
      if (!tx.category_id) continue;

      if (walletFilter !== "all" && tx.wallet_id !== walletFilter) continue;
      if (categoryFilter !== "all" && tx.category_id !== categoryFilter) {
        continue;
      }

      const category = tx.category_id ? categoryMap[tx.category_id] : null;
      if (isInternalTransferCategory(category)) continue;

      if (!result[tx.currency_code]) {
        result[tx.currency_code] = {};
      }
      const inner = result[tx.currency_code];
      inner[tx.category_id] = (inner[tx.category_id] ?? 0) + tx.amount_minor;
    }

    return result;
  }, [
    transactions,
    selectedYear,
    selectedMonth,
    walletFilter,
    categoryFilter,
    categoryMap,
  ]);

  const currencyCodes = useMemo(
    () => Object.keys(expensesByCurrency).sort(),
    [expensesByCurrency]
  );

  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);

  useEffect(() => {
    if (currencyCodes.length === 0) {
      setActiveCurrency(null);
      return;
    }
    if (!activeCurrency || !currencyCodes.includes(activeCurrency)) {
      setActiveCurrency(currencyCodes[0]);
    }
  }, [currencyCodes, activeCurrency]);

  const pieData = useMemo(() => {
    if (!activeCurrency) return [];
    const byCategory = expensesByCurrency[activeCurrency];
    if (!byCategory) return [];

    return Object.entries(byCategory).map(([categoryId, totalMinor]) => ({
      name: categoryMap[categoryId]?.name ?? "Uncategorized",
      value: totalMinor / 100,
    }));
  }, [activeCurrency, expensesByCurrency, categoryMap]);

  const total = pieData.reduce((sum, d) => sum + d.value, 0);

  const centerLabel =
    activeCurrency && total > 0 ? (
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ffffff"
      >
        <tspan fontSize="10">{`TOTAL ${activeCurrency}`}</tspan>
        <tspan x="50%" dy="1.4em" fontSize="18" fontWeight="bold">
          {total.toFixed(2)}
        </tspan>
      </text>
    ) : null;

  const hasData = pieData.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            This Month&apos;s Spending by Category
          </h3>
          <p className="text-[11px] text-gray-400">
            Total expenses by category for the current month. Internal transfers
            are excluded. Use the toggle to switch between currencies.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Currency:</span>
          {currencyCodes.length === 0 ? (
            <span className="text-gray-500">No data</span>
          ) : (
            <div className="inline-flex rounded-full border border-gray-700 bg-black/60 p-1">
              {currencyCodes.map((code) => {
                const active = code === activeCurrency;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setActiveCurrency(code)}
                    className={`px-3 py-0.5 rounded-full text-[11px] ${
                      active
                        ? "bg-white text-black"
                        : "text-gray-300 hover:bg-gray-900"
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="h-72 w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No expense data for this month with the current filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {centerLabel}
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>

              {/* --- UPDATED TOOLTIP ONLY --- */}
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.9)",
                  border: "1px solid #374151",
                  borderRadius: "0.5rem",
                  color: "#fff",
                  fontSize: 12,
                  padding: "6px 10px",
                }}
                itemStyle={{
                  color: "#fff",
                }}
                labelStyle={{
                  color: "#e5e7eb",
                }}
                formatter={(value: any, name: any) => [
                  Number(value).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                  name,
                ]}
              />
              {/* --- END TOOLTIP --- */}

              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{
                  fontSize: 11,
                  color: "#d1d5db",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
