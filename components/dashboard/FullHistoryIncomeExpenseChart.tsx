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

type Point = {
  // incoming shape (daily or monthly)
  day?: string;   // "2025-11-18"
  date?: string;  // alternative
  month?: string; // "2025-11"
  income: number;
  expense: number;
  currencyCode?: string | null;
  currency?: string | null;
};

type FullHistoryIncomeExpenseChartProps = {
  data: Point[];
};

function getCurrency(row: Point): string {
  return (row.currencyCode ?? row.currency ?? "") || "";
}

// Use day/date if present, otherwise month
function getRawDate(row: Point): string {
  return row.day ?? row.date ?? row.month ?? "";
}

// For monthly buckets: YYYY-MM (from day or pre-existing month)
function getMonthKey(row: Point): string {
  const raw = getRawDate(row);
  if (!raw) return "";
  const parts = raw.split("-");
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  }
  return raw;
}

function formatMonthLabel(label: string): string {
  if (!label) return "";
  const [year, month] = label.split("-");
  if (!year || !month) return label;
  const d = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(d.getTime())) return label;
  return d.toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

export default function FullHistoryIncomeExpenseChart({
  data,
}: FullHistoryIncomeExpenseChartProps) {
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

    let filtered = data;
    if (hasCurrencyInfo && activeCurrency) {
      filtered = data.filter((row) => getCurrency(row) === activeCurrency);
    }

    // Aggregate per month
    const buckets = new Map<
      string,
      { label: string; income: number; expense: number; currencyCode?: string }
    >();

    for (const row of filtered) {
      const key = getMonthKey(row);
      if (!key) continue;
      const existing = buckets.get(key) ?? {
        label: key,
        income: 0,
        expense: 0,
        currencyCode: getCurrency(row) || undefined,
      };

      existing.income += row.income ?? 0;
      existing.expense += row.expense ?? 0;
      buckets.set(key, existing);
    }

    const aggregated = Array.from(buckets.values());
    aggregated.sort((a, b) => a.label.localeCompare(b.label));
    return aggregated;
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">All-Time Income vs Expenses</h2>
          <p className="text-xs text-gray-400">
            Monthly totals across your full transaction history. Use the
            currency toggle to focus on one currency at a time.
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
          No transactions yet to build an all-time view.
        </p>
      ) : (
        <div className="border border-gray-800 rounded-lg bg-black/40 p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
              <XAxis
                dataKey="label"
                tickFormatter={formatMonthLabel}
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
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#f9fafb" }}
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
                labelFormatter={(label) => `Month: ${formatMonthLabel(label)}`}
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
