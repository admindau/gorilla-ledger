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

type HistoricalPoint = {
  month?: string; // legacy
  day?: string; // preferred: "2025-11-01"
  date?: string; // alternative
  income: number;
  expense: number;
  currencyCode?: string;
  currency?: string;
};

type HistoricalIncomeExpenseChartProps = {
  data: HistoricalPoint[];
};

function getCurrency(row: HistoricalPoint): string {
  return row.currencyCode ?? row.currency ?? "";
}

function getDateLabel(row: HistoricalPoint): string {
  return row.day ?? row.date ?? row.month ?? "";
}

function formatDateLabel(label: string): string {
  if (!label) return "";
  const parts = label.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
      });
    }
  }
  return label;
}

export default function HistoricalIncomeExpenseChart({
  data,
}: HistoricalIncomeExpenseChartProps) {
  const hasRawData = data && data.length > 0;

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const row of data) {
      const code = getCurrency(row);
      if (code) {
        set.add(code);
      }
    }
    return Array.from(set).sort();
  }, [data]);

  const [activeCurrency, setActiveCurrency] = useState<string | null>(
    currencies.length > 0 ? currencies[0] : null
  );

  const hasCurrencyInfo = currencies.length > 0;

  const chartData = useMemo(() => {
    if (!hasRawData) return [];

    let filtered = data;

    if (hasCurrencyInfo && activeCurrency) {
      // filter to ONE currency at a time
      filtered = data.filter((row) => getCurrency(row) === activeCurrency);
    }

    const withLabels = filtered
      .map((row) => ({
        ...row,
        label: getDateLabel(row),
      }))
      .filter((row) => row.label);

    withLabels.sort((a, b) => (a.label as string).localeCompare(b.label as string));

    return withLabels;
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">
            Historical Income vs Expenses – Last 12 Months
          </h2>
          <p className="text-xs text-gray-400">
            Daily totals across the last 12 months. When currency metadata is
            present, you can focus on one currency at a time using the toggle.
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
          Not enough data yet to show a 12-month trend.
        </p>
      ) : (
        <div className="border border-gray-800 rounded-lg bg-black/40 p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
              <XAxis
                dataKey="label"
                tickFormatter={formatDateLabel}
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
                  color: "#f9fafb",
                }}
                labelStyle={{
                  color: "#e5e7eb",
                }}
                itemStyle={{
                  color: "#f9fafb",
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
                labelFormatter={(label) => `Date: ${label}`}
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
