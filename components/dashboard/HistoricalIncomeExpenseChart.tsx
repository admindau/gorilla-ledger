"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

type TxRow = {
  occurred_at: string;
  amount_minor: number;
  type: "income" | "expense";
  currency_code: string;
};

type MonthBucket = {
  key: string; // YYYY-MM
  label: string; // e.g. "Jan 25"
  byCurrency: Record<
    string,
    {
      income: number;
      expense: number;
    }
  >;
};

type ChartPoint = {
  monthLabel: string;
  income: number;
  expenses: number;
};

function formatAmount(amount: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildMonthBuckets(): MonthBucket[] {
  const now = new Date();
  // First day of the current month
  now.setDate(1);
  now.setHours(0, 0, 0, 0);

  const buckets: MonthBucket[] = [];

  // Last 12 months, oldest first
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);

    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;

    const label = d.toLocaleString("en-US", {
      month: "short",
      year: "2-digit",
    });

    buckets.push({
      key,
      label,
      byCurrency: {},
    });
  }

  return buckets;
}

export default function HistoricalIncomeExpenseChart() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const supabase = supabaseBrowserClient;

        const now = new Date();
        now.setDate(1);
        now.setHours(0, 0, 0, 0);

        const start = new Date(now);
        start.setMonth(start.getMonth() - 11); // 12 months including current

        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from("transactions")
          .select("occurred_at, amount_minor, type, currency_code")
          .gte("occurred_at", start.toISOString())
          .lte("occurred_at", end.toISOString());

        if (error) {
          console.error("Error loading historical income/expenses", error);
          setError("Failed to load income and expense history.");
          return;
        }

        const cleaned =
          (data as any[])
            ?.filter(
              (row) =>
                row &&
                typeof row.amount_minor === "number" &&
                typeof row.occurred_at === "string" &&
                (row.type === "income" || row.type === "expense") &&
                typeof row.currency_code === "string"
            )
            .map((row) => ({
              occurred_at: row.occurred_at,
              amount_minor: row.amount_minor,
              type: row.type as "income" | "expense",
              currency_code: row.currency_code as string,
            })) ?? [];

        setRows(cleaned);

        // Default currency = first one we see
        const firstCurrency = cleaned[0]?.currency_code ?? null;
        setActiveCurrency((current) => current ?? firstCurrency);
      } catch (err) {
        console.error(err);
        setError("Failed to load income and expense history.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.currency_code) set.add(r.currency_code);
    }
    return Array.from(set);
  }, [rows]);

  const monthBuckets = useMemo(() => {
    const buckets = buildMonthBuckets();
    const byKey: Record<string, MonthBucket> = {};
    for (const b of buckets) {
      byKey[b.key] = b;
    }

    for (const row of rows) {
      const d = new Date(row.occurred_at);
      if (Number.isNaN(d.getTime())) continue;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const bucket = byKey[key];
      if (!bucket) continue;

      const currency = row.currency_code;
      if (!bucket.byCurrency[currency]) {
        bucket.byCurrency[currency] = { income: 0, expense: 0 };
      }

      const dest = bucket.byCurrency[currency];
      const amount = row.amount_minor / 100;

      if (row.type === "income") {
        dest.income += amount;
      } else if (row.type === "expense") {
        dest.expense += amount;
      }
    }

    return buckets;
  }, [rows]);

  const chartData: ChartPoint[] = useMemo(() => {
    if (!activeCurrency) return [];

    return monthBuckets.map((bucket) => {
      const entry = bucket.byCurrency[activeCurrency] ?? {
        income: 0,
        expense: 0,
      };
      return {
        monthLabel: bucket.label,
        income: entry.income,
        expenses: entry.expense,
      };
    });
  }, [monthBuckets, activeCurrency]);

  return (
    <section className="mt-10 border border-zinc-800 rounded-lg bg-black/40 p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold">
            Income vs Expenses – Last 12 Months
          </h2>
          <p className="text-xs text-zinc-400">
            Monthly totals for the past year, per currency. No FX conversion
            applied.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {currencies.length === 0 ? (
            <span className="text-zinc-500">No data yet</span>
          ) : (
            currencies.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setActiveCurrency(code)}
                className={`px-3 py-1 rounded-full border text-[11px] ${
                  activeCurrency === code
                    ? "bg-white text-black border-white"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {code}
              </button>
            ))
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-zinc-500 py-12 text-center">
          Loading income and expense history…
        </div>
      ) : error ? (
        <div className="text-xs text-red-400 py-12 text-center">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="text-xs text-zinc-500 py-12 text-center">
          No transactions found in the last 12 months.
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 0, right: 20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
                tickFormatter={(value: number) => formatAmount(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #27272a",
                  borderRadius: "0.75rem",
                  fontSize: "11px",
                }}
                formatter={(value: any, name, props: any) => {
                  const key = props?.dataKey as string | undefined;
                  const label =
                    key === "income"
                      ? "Income"
                      : key === "expenses"
                      ? "Expenses"
                      : String(name);
                  return [
                    formatAmount(typeof value === "number" ? value : 0),
                    label,
                  ];
                }}
                labelStyle={{ color: "#e4e4e7" }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "11px",
                }}
              />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#22c55e" // green (Rasta)
                strokeWidth={1.6}
                dot={{ r: 2 }}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#ef4444" // red (Rasta)
                strokeWidth={1.4}
                dot={{ r: 2 }}
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
