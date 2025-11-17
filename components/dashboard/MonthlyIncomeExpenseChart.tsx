"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type MonthlyPoint = {
  month: string; // e.g. "2025-01"
  income: number; // major units
  expense: number; // major units
  currencyCode?: string;
  currency?: string;
};

type MonthlyIncomeExpenseChartProps = {
  data: MonthlyPoint[];
};

function getCurrency(row: MonthlyPoint): string {
  return row.currencyCode ?? row.currency ?? "";
}

export default function MonthlyIncomeExpenseChart({
  data,
}: MonthlyIncomeExpenseChartProps) {
  const hasRawData = data && data.length > 0;

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const row of data) {
      const code = getCurrency(row);
      if (code) set.add(code);
    }
    return Array.from(set).sort();
  }, [data]);

  const [activeCurrency, setActiveCurrency] = useState<string | null>(
    currencies.length > 0 ? currencies[0] : null
  );

  const hasCurrencyInfo = currencies.length > 0;

  const chartData = useMemo(() => {
    if (!hasRawData) return [];

    if (!hasCurrencyInfo || !activeCurrency) {
      // no currency metadata – show combined data
      return data;
    }

    return data.filter((row) => getCurrency(row) === activeCurrency);
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">Monthly Income vs Expenses</h2>
          <p className="text-xs text-gray-400">
            Totals per month across your transactions. When currency metadata is
            available, use the toggle to focus on one currency at a time.
            Internal transfers should already be excluded by the upstream
            aggregation.
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

      {!hasData ? (
        <p className="text-xs text-gray-500">
          No transactions yet to build this trend.
        </p>
      ) : (
        <div className="border border-gray-800 rounded-lg bg-black/40 p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.9)",
                  border: "1px solid #374151",
                  borderRadius: "0.5rem",
                  fontSize: 11,
                }}
                formatter={(value: number | string) => {
                  if (typeof value === "number") {
                    return value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  }
                  const parsed = Number(value);
                  if (!Number.isNaN(parsed)) {
                    return parsed.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  }
                  return value;
                }}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  color: "#d1d5db",
                }}
              />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#22c55e"
                strokeWidth={1.8}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expenses"
                stroke="#ef4444"
                strokeWidth={1.8}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
