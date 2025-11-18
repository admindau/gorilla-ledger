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
  day?: string;   // "2025-11-18"
  date?: string;  // alternative
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

export default function CumulativeNetBalanceChart({
  data,
}: CumulativeNetBalanceChartProps) {
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

    // Group by date, then compute cumulative net balance
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
      const netForDay = income - expense; // both are positive numbers

      existing.net += netForDay;
      perDate.set(key, existing);
    }

    const sorted = Array.from(perDate.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    let running = 0;
    const cumulative = sorted.map((row) => {
      running += row.net;
      return {
        label: row.label,
        net: row.net,
        balance: running,
        currencyCode: row.currencyCode,
      };
    });

    return cumulative;
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

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
                formatter={(value: number | string, name: string) => {
                  if (typeof value === "number") {
                    return [
                      value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                      name,
                    ];
                  }
                  const parsed = Number(value);
                  if (!Number.isNaN(parsed)) {
                    return [
                      parsed.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                      name,
                    ];
                  }
                  return [value, name];
                }}
                labelFormatter={(label) => `Date: ${formatDateLabel(label)}`}
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
