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
  walletFilter: string;   // "all" or wallet id
  categoryFilter: string; // "all" or category id
  yearFilter: string;     // "all" or specific year like "2025"
};

function isInternalTransferCategory(category?: Category | null): boolean {
  if (!category) return false;
  const n = category.name.toLowerCase().trim();
  return n.startsWith("transfer");
}

type ChartPoint = {
  name: string;
  value: number;       // major units
};

type DataByCurrency = Record<string, ChartPoint[]>;

export default function TopCategoriesBarChart({
  transactions,
  categories,
  walletFilter,
  categoryFilter,
  yearFilter,
}: Props) {
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c] as const)),
    [categories]
  );

  const currentYear = new Date().getFullYear();
  const targetYear =
    yearFilter === "all"
      ? currentYear
      : Number.parseInt(yearFilter, 10) || currentYear;

  // Build "top 5 categories per currency" for the chosen year & filters
  const dataByCurrency: DataByCurrency = useMemo(() => {
    const sums: Record<string, Record<string, number>> = {};

    for (const tx of transactions) {
      const d = new Date(tx.occurred_at);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== targetYear) continue;

      if (tx.type !== "expense") continue;
      if (!tx.category_id) continue;

      if (walletFilter !== "all" && tx.wallet_id !== walletFilter) continue;
      if (categoryFilter !== "all" && tx.category_id !== categoryFilter) {
        continue;
      }

      const category = tx.category_id ? categoryMap[tx.category_id] : null;
      if (isInternalTransferCategory(category)) continue;

      const currency = tx.currency_code;
      if (!sums[currency]) sums[currency] = {};
      if (!sums[currency][tx.category_id]) sums[currency][tx.category_id] = 0;
      sums[currency][tx.category_id] += tx.amount_minor;
    }

    const result: DataByCurrency = {};

    for (const [currency, catMap] of Object.entries(sums)) {
      const topFive = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([categoryId, totalMinor]) => ({
          name: categoryMap[categoryId]?.name ?? "Uncategorized",
          value: totalMinor / 100, // convert to major units
        }));

      result[currency] = topFive;
    }

    return result;
  }, [
    transactions,
    categoryMap,
    walletFilter,
    categoryFilter,
    targetYear,
  ]);

  const currencyCodes = useMemo(
    () => Object.keys(dataByCurrency).sort(),
    [dataByCurrency]
  );

  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);

  // Keep active currency in sync with available data
  useEffect(() => {
    if (currencyCodes.length === 0) {
      setActiveCurrency(null);
      return;
    }
    if (!activeCurrency || !currencyCodes.includes(activeCurrency)) {
      setActiveCurrency(currencyCodes[0]);
    }
  }, [currencyCodes, activeCurrency]);

  const dataForChart: ChartPoint[] = useMemo(() => {
    if (!activeCurrency) return [];
    return dataByCurrency[activeCurrency] ?? [];
  }, [dataByCurrency, activeCurrency]);

  const hasData = dataForChart.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            Top Spending Categories – This Year
          </h3>
          <p className="text-[11px] text-gray-400">
            Highest expense categories for the selected year and filters.
            Amounts are shown in major units (no FX conversion). Use the toggle
            to switch between currencies.
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
            No expense data for this year with the current filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dataForChart}
              margin={{ top: 10, right: 10, bottom: 25, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1f2937"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#d1d5db" }}
                tickMargin={8}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickMargin={6}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid #1f2937",
                  fontSize: 11,
                  color: "#e5e7eb",
                }}
                formatter={(value: any) => [
                  (value as number).toFixed(2),
                  "total",
                ]}
              />
              <Bar
                dataKey="value"
                radius={[8, 8, 0, 0]}
                fill="#22c55e" // bright green
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
