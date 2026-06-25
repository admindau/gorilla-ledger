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
import ChartTooltip from "@/components/charts/ChartTooltip";
import { chartMargins, chartTheme } from "@/components/charts/chartTheme";

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
  }

  // Monthly label: YYYY-MM -> "Dec 2025" (future-proof)
  if (parts.length === 2) {
    const [year, month] = parts;
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    }
  }

  return label;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function HistoricalIncomeExpenseChart({
  data,
}: HistoricalIncomeExpenseChartProps) {
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

  // Best practice: keep activeCurrency valid when data changes
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
    if (!hasRawData) return [];

    const filtered =
      hasCurrencyInfo && activeCurrency
        ? data.filter((row) => getCurrency(row) === activeCurrency)
        : data;

    const withLabels = filtered
      .map((row) => ({
        ...row,
        label: getDateLabel(row),
      }))
      .filter((row) => row.label);

    withLabels.sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );

    return withLabels;
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  // Tick density: 12 months daily needs controlled ticks
  const xInterval = useMemo(() => {
    const n = chartData.length;
    if (n <= 30) return 3; // about weekly
    if (n <= 120) return Math.max(1, Math.floor(n / 10)); // ~10 ticks
    return Math.max(1, Math.floor(n / 12)); // ~12 ticks
  }, [chartData.length]);

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
        <div className="gl-card gl-chart-surface h-80 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={chartMargins.line}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />

              <XAxis
                dataKey="label"
                tickFormatter={(v) => formatDateLabel(String(v))}
                tick={{ fontSize: 10, fill: chartTheme.tickFill }}
                axisLine={{ stroke: chartTheme.axisStroke }}
                tickLine={{ stroke: chartTheme.axisStroke }}
                minTickGap={18}
                interval={xInterval}
              />

              <YAxis
                tick={{ fontSize: 10, fill: chartTheme.tickFill }}
                axisLine={{ stroke: chartTheme.axisStroke }}
                tickLine={{ stroke: chartTheme.axisStroke }}
                tickFormatter={(v) => Number(v).toLocaleString()}
              />

              <Tooltip
                wrapperStyle={chartTheme.tooltipWrapper}
                content={                    
                  <ChartTooltip
                    labelFormatter={(label) =>
                      `Date: ${formatDateLabel(String(label))}`
                    }
                    valueFormatter={(value) => {
                      if (value == null) return "";

                      const numeric =
                        typeof value === "number" ? value : Number(value);

                      return Number.isNaN(numeric) ? String(value) : formatNumber(numeric);
                    }}
                  />
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
                stroke={chartTheme.lineIncome}
                strokeWidth={1.8}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expenses"
                stroke={chartTheme.lineExpense}
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
