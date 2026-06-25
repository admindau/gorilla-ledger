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

type Point = {
  day?: string; // "2025-11-18"
  date?: string; // alternative
  month?: string; // "2025-11"
  income: number;
  expense: number;
  currencyCode?: string | null;
  currency?: string | null;
};

type CumulativeNetBalanceChartProps = {
  data: Point[];
};

function getCurrency(row: Point): string {
  return (row.currencyCode ?? row.currency ?? "") || "";
}

function getRawDate(row: Point): string {
  return row.day ?? row.date ?? row.month ?? "";
}

function formatDateLabel(label: string): string {
  if (!label) return "";
  const parts = label.split("-");

  // Daily: YYYY-MM-DD -> "24 Dec 25"
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });
    }
  }

  // Monthly: YYYY-MM -> "Dec 25" (future-proof)
  if (parts.length === 2) {
    const [year, month] = parts;
    const d = new Date(Number(year), Number(month) - 1, 1);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
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

export default function CumulativeNetBalanceChart({
  data,
}: CumulativeNetBalanceChartProps) {
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

  // Keep activeCurrency valid when data/filters change
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

    // Group by date (daily preferred), compute cumulative net FLOW
    const perDate = new Map<string, { label: string; net: number }>();

    for (const row of filtered) {
      const key = getRawDate(row);
      if (!key) continue;

      const existing = perDate.get(key) ?? { label: key, net: 0 };

      const income = row.income ?? 0;
      const expense = row.expense ?? 0;

      // Net flow for the day: income - expense
      existing.net += income - expense;

      perDate.set(key, existing);
    }

    const sorted = Array.from(perDate.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    let running = 0;
    return sorted.map((row) => {
      running += row.net;
      return {
        label: row.label,
        net: row.net,
        cumulativeNetFlow: running,
      };
    });
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  // Tick density for long all-time series
  const xInterval = useMemo(() => {
    const n = chartData.length;
    if (n <= 45) return 3; // roughly weekly
    if (n <= 180) return Math.max(1, Math.floor(n / 10)); // ~10 ticks
    return Math.max(1, Math.floor(n / 12)); // ~12 ticks on long horizons
  }, [chartData.length]);

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">
            Cumulative Net Flow — All Time
          </h2>
          <p className="text-xs text-gray-400">
            Income minus expenses accumulated over time. This reflects net flow
            (not wallet balances) and does not include starting balances.
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
          No transactions yet to build a cumulative net flow view.
        </p>
      ) : (
        <div className="gl-card gl-chart-surface h-80 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={chartMargins.line}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />

              <XAxis
                dataKey="label"
                tickFormatter={formatDateLabel}
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
                    valueFormatter={(value, name) => {
                      const numeric =
                        typeof value === "number" ? value : Number(value ?? 0);

                      return Number.isNaN(numeric)
                        ? String(value ?? "")
                        : formatNumber(numeric);
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
                dataKey="cumulativeNetFlow"
                name="Cumulative net flow"
                stroke={chartTheme.lineIncome}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
