"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type RawRow = {
  user_id: string;
  currency: string;
  category_name: string | null;
  total_spent: number;
};

type ChartDatum = {
  categoryName: string;
  currencyCode: string;
  totalAmount: number;
};

type TopCategoriesBarChartProps = {
  data?: { name: string; value: number; currency?: string }[];
};

const BAR_COLORS: Record<string, string> = {
  SSP: "#F97373",
  USD: "#22C55E",
  KES: "#FACC15",
};

export default function TopCategoriesBarChart(
  props: TopCategoriesBarChartProps
) {
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fallback data from props (if Supabase is empty or errors)
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
          // 🔁 NOTE: now using the *YEAR* view
          supabase.from("category_spending_current_year").select("*"),
        ]);

        if (error) {
          console.error("Error loading top categories:", error);
          setRawData(initialRowsFromProps);
          return;
        }

        const user = userData?.user ?? null;
        const typed = (data ?? []) as RawRow[];

        // Restrict to the logged-in user
        const scoped =
          user && user.id
            ? typed.filter((row) => row.user_id === user.id)
            : typed;

        if (scoped.length === 0 && initialRowsFromProps.length > 0) {
          setRawData(initialRowsFromProps);
        } else {
          setRawData(scoped);
        }
      } catch (error) {
        console.error("Unexpected error loading top categories:", error);
        setRawData(initialRowsFromProps);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [initialRowsFromProps]);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const row of rawData) {
      if (row.currency) {
        set.add(row.currency);
      }
    }
    return Array.from(set).sort();
  }, [rawData]);

  useEffect(() => {
    if (!activeCurrency && currencies.length > 0) {
      setActiveCurrency(currencies[0]);
    }
  }, [currencies, activeCurrency]);

  const chartData = useMemo<ChartDatum[]>(() => {
    if (!activeCurrency) return [];

    // Filter to the active currency
    const filtered = rawData.filter((row) => row.currency === activeCurrency);

    // Aggregate per categoryName (no duplicates)
    const totals = new Map<string, number>();

    for (const row of filtered) {
      const name = row.category_name ?? "Uncategorized";
      const prev = totals.get(name) ?? 0;
      totals.set(name, prev + row.total_spent);
    }

    const aggregated: ChartDatum[] = Array.from(totals.entries()).map(
      ([name, total]) => ({
        categoryName: name,
        currencyCode: activeCurrency,
        totalAmount: total,
      })
    );

    return aggregated
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
  }, [rawData, activeCurrency]);

  const hasData = chartData.length > 0;
  const barColor =
    (activeCurrency && BAR_COLORS[activeCurrency]) || "#22C55E";

  return (
    <section className="border border-gray-900 rounded-lg bg-black/50 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold">
            Top Spending Categories – This Year
          </h2>
          <p className="text-[11px] text-gray-400">
            Highest expense categories for the current year (top five per
            currency), powered by the{" "}
            <span className="font-mono text-gray-300">
              category_spending_current_year
            </span>{" "}
            view.
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
        <p className="text-xs text-gray-500">Loading chart data…</p>
      ) : currencies.length === 0 ? (
        <p className="text-xs text-gray-500">
          No expenses recorded this year yet.
        </p>
      ) : !hasData ? (
        <p className="text-xs text-gray-500">
          No expenses recorded yet for{" "}
          <span className="font-mono">{activeCurrency}</span> this year.
          Record some transactions to see your annual top categories.
        </p>
      ) : (
        <div className="h-[260px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
            >
              <XAxis
                dataKey="categoryName"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "#1F2937" }}
                tick={{ fontSize: 11, fill: "#6B7280" }}
                width={60}
              />
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
                labelFormatter={(label) => `${label}`}
              />
              <Bar
                dataKey="totalAmount"
                radius={[4, 4, 0, 0]}
                fill={barColor}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
