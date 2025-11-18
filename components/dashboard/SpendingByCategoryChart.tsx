"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type RawRow = {
  user_id: string;
  currency: string;
  category_name: string | null;
  total_spent: number;
};

type SpendingByCategoryChartProps = {
  data?: {
    name: string;
    value: number;
    currency?: string;
  }[];
};

type PieDatum = {
  name: string;
  value: number;
};

const RASTA_COLORS = ["#EF4444", "#FACC15", "#22C55E", "#F97316", "#A855F7"];

export default function SpendingByCategoryChart(
  props: SpendingByCategoryChartProps
) {
  const [rows, setRows] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);

  // Fallback rows from props.data (in case Supabase is empty or fails)
  const initialRowsFromProps = useMemo<RawRow[]>(
    () =>
      (props.data ?? []).map((d) => ({
        user_id: "",
        currency: d.currency ?? "",
        category_name: d.name,
        total_spent: d.value,
      })),
    [props.data]
  );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const supabase = supabaseBrowserClient;

        const [{ data: userData }, { data, error }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from("category_spending_current_month").select("*"),
        ]);

        if (error) {
          console.error("Error loading category spending:", error);
          setRows(initialRowsFromProps);
          return;
        }

        const user = userData?.user ?? null;

        const typed = (data ?? []) as RawRow[];

        // SAFETY: only show rows for this logged-in user
        const scoped =
          user && user.id
            ? typed.filter((row) => row.user_id === user.id)
            : typed;

        if (scoped.length === 0 && initialRowsFromProps.length > 0) {
          setRows(initialRowsFromProps);
        } else {
          setRows(scoped);
        }
      } catch (err) {
        console.error("Unexpected error loading category spending:", err);
        setRows(initialRowsFromProps);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [initialRowsFromProps]);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.currency) set.add(row.currency);
    }
    return Array.from(set).sort();
  }, [rows]);

  useEffect(() => {
    if (!activeCurrency && currencies.length > 0) {
      setActiveCurrency(currencies[0]);
    }
  }, [currencies, activeCurrency]);

  const { chartData, totalForCurrency } = useMemo(() => {
    if (!activeCurrency) {
      return { chartData: [] as PieDatum[], totalForCurrency: 0 };
    }

    const filtered = rows.filter((r) => r.currency === activeCurrency);

    if (filtered.length === 0) {
      return { chartData: [] as PieDatum[], totalForCurrency: 0 };
    }

    // Convert to chart-friendly data
    const base = filtered.map((r) => ({
      name: r.category_name ?? "Uncategorized",
      value: r.total_spent,
    }));

    // Sum total for selected currency
    const total = base.reduce((sum, item) => sum + item.value, 0);

    // Sort and group "Other"
    const sorted = [...base].sort((a, b) => b.value - a.value);
    const TOP_N = 6;
    const top = sorted.slice(0, TOP_N);
    const rest = sorted.slice(TOP_N);
    const restTotal = rest.reduce((sum, item) => sum + item.value, 0);

    const finalData =
      restTotal > 0 ? [...top, { name: "Other", value: restTotal }] : top;

    return { chartData: finalData, totalForCurrency: total };
  }, [rows, activeCurrency]);

  const hasData = chartData.length > 0;

  return (
    <section className="border border-gray-900 rounded-lg bg-black/50 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold">
            This Month&apos;s Spending by Category
          </h2>
          <p className="text-[11px] text-gray-400">
            Total expenses by category for the current month. Internal transfers
            are excluded. Use the toggle to switch between currencies.
          </p>
        </div>

        {currencies.length > 0 && (
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

      {loading ? (
        <p className="text-xs text-gray-500">Loading spending data…</p>
      ) : currencies.length === 0 ? (
        <p className="text-xs text-gray-500">
          No expenses recorded this month yet.
        </p>
      ) : !hasData ? (
        <p className="text-xs text-gray-500">
          No expenses recorded yet for{" "}
          <span className="font-mono">{activeCurrency}</span> this month.
        </p>
      ) : (
        <div className="relative h-[260px] sm:h-[280px]">
          {/* Center label with total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">
              Total {activeCurrency}
            </p>
            <p className="text-lg font-semibold">
              {totalForCurrency.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={RASTA_COLORS[index % RASTA_COLORS.length]}
                  />
                ))}
              </Pie>
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
                formatter={(value: number | string, _name, payload) => {
                  if (typeof value === "number") {
                    const percentage =
                      totalForCurrency > 0
                        ? (value / totalForCurrency) * 100
                        : 0;
                    return [
                      value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                      `${payload?.payload?.name} (${percentage.toFixed(1)}%)`,
                    ];
                  }
                  return value;
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  color: "#d1d5db",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
