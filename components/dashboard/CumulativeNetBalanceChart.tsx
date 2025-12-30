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

  // Best practice: keep activeCurrency valid when data/filters change
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

    // Group by date (daily preferred), compute cumulative net balance
    const perDate = new Map<
      string,
      { label: string; net: number; currencyCode?: string }
    >();

    for (const row of filtered) {
      const key = getRawDate(row);
      if (!key) continue;

      const existing = perDate.get(key) ?? {
        label: key,
        net: 0,
        currencyCode: getCurrency(row) || undefined,
      };

      const income = row.income ?? 0;
      const expense = row.expense ?? 0;

      // Both values are positive; net is income - expense
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
        balance: running,
        currencyCode: row.currencyCode,
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
            Cumulative Net Balance – All Time
          </h2>
          <p className="text-xs text-gray-400">
            Net income minus expenses, stacked over time. Use the currency
            toggle to track long-term balance trends.
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
          No transactions yet to build a cumulative balance.
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
                formatter={(value: number | string, name: string) => {
                  const num = typeof value === "number" ? value : Number(value);
                  if (!Number.isNaN(num)) return [formatNumber(num), name];
                  return [value, name];
                }}
                labelFormatter={(label) => `Date: ${formatDateLabel(String(label))}`}
              />

              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  color: "#d1d5db",
                }}
              />

              <Line
                type="monotone"
                dataKey="balance"
                name="Cumulative balance"
                stroke="#22c55e"
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
