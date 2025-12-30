"use client";

import { useEffect, useMemo, useState } from "react";
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

type TimeSeriesPoint = {
  // we support multiple possible keys so the component is flexible
  month?: string; // legacy: "2025-11"
  day?: string; // new: "2025-11-01"
  date?: string; // alternative: "2025-11-01"
  income: number; // major units
  expense: number; // major units
  currencyCode?: string;
  currency?: string;
};

type MonthlyIncomeExpenseChartProps = {
  data: TimeSeriesPoint[];
};

function getCurrency(row: TimeSeriesPoint): string {
  return row.currencyCode ?? row.currency ?? "";
}

function getDateLabel(row: TimeSeriesPoint): string {
  return row.day ?? row.date ?? row.month ?? "";
}

function formatDateLabel(label: string): string {
  if (!label) return "";

  const parts = label.split("-");

  // Daily label: YYYY-MM-DD -> "24 Dec"
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
      });
    }
    return label;
  }

  // Monthly label: YYYY-MM -> "Dec 2025"
  if (parts.length === 2) {
    const [year, month] = parts;
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    }
    return label;
  }

  return label;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function MonthlyIncomeExpenseChart({
  data,
}: MonthlyIncomeExpenseChartProps) {
  const hasRawData = Array.isArray(data) && data.length > 0;

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const row of data) {
      const code = getCurrency(row);
      if (code) set.add(code);
    }
    return Array.from(set).sort();
  }, [data]);

  const hasCurrencyInfo = currencies.length > 0;

  const [activeCurrency, setActiveCurrency] = useState<string | null>(
    hasCurrencyInfo ? currencies[0] : null
  );

  /**
   * Best practice: if the dataset changes (e.g., month navigation),
   * ensure the active currency remains valid.
   */
  useEffect(() => {
    if (!hasCurrencyInfo) {
      if (activeCurrency !== null) setActiveCurrency(null);
      return;
    }

    // If active is missing/invalid, fall back to first available.
    if (!activeCurrency || !currencies.includes(activeCurrency)) {
      setActiveCurrency(currencies[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCurrencyInfo, currencies.join("|")]);

  const chartData = useMemo(() => {
    if (!hasRawData) return [];

    const filtered =
      hasCurrencyInfo && activeCurrency
        ? data.filter((row) => getCurrency(row) === activeCurrency)
        : data;

    const withLabels = filtered
      .map((row) => ({
        ...row, // IMPORTANT: spread row (fixes the ".row" issue)
        label: getDateLabel(row),
      }))
      .filter((row) => row.label);

    // Sort by label (YYYY-MM-DD sorts correctly lexicographically)
    withLabels.sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );

    return withLabels;
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  /**
   * Tick density: show fewer x-axis ticks as the series grows.
   * For a monthly daily series (~28–31 points), this will keep labels readable.
   */
  const xInterval = useMemo(() => {
    const n = chartData.length;
    if (n <= 10) return 0; // show all
    if (n <= 20) return 1; // every 2nd tick
    if (n <= 35) return 3; // about weekly spacing
    return Math.max(1, Math.floor(n / 10));
  }, [chartData.length]);

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">Monthly Income vs Expenses</h2>
          <p className="text-xs text-gray-400">
            Daily totals across your transactions. When currency metadata is
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
                dataKey="label"
                tickFormatter={(v) => formatDateLabel(String(v))}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#374151" }}
                tickLine={{ stroke: "#374151" }}
                minTickGap={18}
                interval={xInterval}
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
                formatter={(value: number | string) => {
                  const num = typeof value === "number" ? value : Number(value);
                  if (!Number.isNaN(num)) return formatNumber(num);
                  return value;
                }}
                labelFormatter={(label) =>
                  `Date: ${formatDateLabel(String(label))}`
                }
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
