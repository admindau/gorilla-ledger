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
  category_name: string;
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

  // Fallback rows from props.data (in case Supabase is empty or not available)
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

        const { data, error } = await supabase
          .from("category_spending_current_month")
          .select("*");

        if (error) {
          console.error("Error loading category spending:", error);
          // fall back to any data passed via props
          setRows(initialRowsFromProps);
          return;
        }

        const typed = (data ?? []) as RawRow[];
        if (typed.length === 0 && initialRowsFromProps.length > 0) {
          setRows(initialRowsFromProps);
        } else {
          setRows(typed);
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

  const chartData: PieDatum[] = useMemo(() => {
    if (!activeCurrency) return [];
    return rows
      .filter((r) => r.currency === activeCurrency)
      .map((r) => ({
        name: r.category_name ?? "Uncategorized",
        value: r.total_spent,
      }))
      .filter((d) => d.value !== 0);
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
            Shows total expenses by category for the current month, grouped by
            currency. Internal transfers are excluded by the view.
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
        <div className="h-[260px] sm:h-[280px]">
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
                formatter={(value: number | string) =>
                  typeof value === "number"
                    ? value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : value
                }
                contentStyle={{
                  backgroundColor: "#020617",
                  borderColor: "#1f2937",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={32}
                wrapperStyle={{ fontSize: 11, color: "#d1d5db" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
