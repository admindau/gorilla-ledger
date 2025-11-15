"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
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

type TxRow = {
  amount_minor: number;
  type: "income" | "expense";
  currency_code: string;
  occurred_at: string;
};

type Point = {
  dateLabel: string;
  income: number;
  expenses: number;
};

type CurrencySeries = {
  currency: string;
  points: Point[];
};

function getCurrentMonthRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function buildSeries(rows: TxRow[]): CurrencySeries[] {
  const byCurrency: Record<
    string,
    Record<string, { income: number; expenses: number }>
  > = {};

  for (const row of rows) {
    const occurred = new Date(row.occurred_at);
    if (Number.isNaN(occurred.getTime())) continue;

    const dateKey = occurred.toISOString().slice(0, 10); // YYYY-MM-DD
    const currency = row.currency_code;

    if (!byCurrency[currency]) byCurrency[currency] = {};
    if (!byCurrency[currency][dateKey]) {
      byCurrency[currency][dateKey] = { income: 0, expenses: 0 };
    }

    const major = row.amount_minor / 100;

    if (row.type === "income") {
      byCurrency[currency][dateKey].income += major;
    } else {
      byCurrency[currency][dateKey].expenses += major;
    }
  }

  return Object.entries(byCurrency).map(([currency, byDate]) => {
    const dates = Object.keys(byDate).sort();
    const points: Point[] = dates.map((d) => {
      const { income, expenses } = byDate[d];
      const dt = new Date(d);
      const label = dt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      return { dateLabel: label, income, expenses };
    });

    return { currency, points };
  });
}

export default function MonthlyIncomeExpenseChart() {
  const [series, setSeries] = useState<CurrencySeries[]>([]);
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const now = new Date();
        const { startIso, endIso } = getCurrentMonthRange(now);

        const { data, error } = await supabaseBrowserClient
          .from("transactions")
          .select("amount_minor,type,currency_code,occurred_at")
          .gte("occurred_at", startIso)
          .lt("occurred_at", endIso);

        if (error) {
          console.error("Failed to load monthly transactions", error);
          if (!cancelled) setError("Unable to load income/expense trend.");
          return;
        }

        const rows = (data ?? []) as TxRow[];
        const built = buildSeries(rows);

        if (!cancelled) {
          setSeries(built);
          if (built.length > 0 && !activeCurrency) {
            setActiveCurrency(built[0].currency);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSeries = useMemo(
    () => series.find((s) => s.currency === activeCurrency),
    [series, activeCurrency]
  );

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-1">
        Income vs Expenses – This Month
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Daily totals for the current month, per currency.
      </p>

      <div className="flex justify-end gap-2 mb-4">
        {series.map((s) => (
          <button
            key={s.currency}
            type="button"
            onClick={() => setActiveCurrency(s.currency)}
            className={`px-3 py-1 rounded-full text-[11px] border transition ${
              activeCurrency === s.currency
                ? "bg-white text-black border-white"
                : "border-gray-700 text-gray-300 hover:bg-gray-900"
            }`}
          >
            {s.currency}
          </button>
        ))}
      </div>

      <div className="border border-gray-800 rounded-lg bg-black/40 p-4 h-72">
        {loading ? (
          <p className="text-xs text-gray-500">Loading monthly trend…</p>
        ) : error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : !activeSeries || activeSeries.points.length === 0 ? (
          <p className="text-xs text-gray-500">
            No income or expense transactions recorded for this month yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activeSeries.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
              <XAxis
                dataKey="dateLabel"
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
                formatter={(value: any) =>
                  typeof value === "number"
                    ? value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : value
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
                stroke="#22c55e" // green (Rasta)
                strokeWidth={1.8}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#ef4444" // red (Rasta)
                strokeWidth={1.8}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
