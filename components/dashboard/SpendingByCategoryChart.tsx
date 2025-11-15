"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import {
  PieChart,
  Pie,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Label,
} from "recharts";

type RawTransaction = {
  category_id: string | null;
  amount_minor: number;
  currency_code: string;
  type: "income" | "expense";
  occurred_at: string;
};

type Category = {
  id: string;
  name: string;
};

type ChartPoint = {
  categoryName: string;
  totalMajor: number;
};

type ChartDataByCurrency = Record<string, ChartPoint[]>;

// Rasta-inspired palette (red, gold, green) with a few darker tints.
// We still avoid pure white so the ring + tooltip stay readable on black.
const COLORS = [
  "#ef4444", // bright red
  "#f97316", // orange accent
  "#facc15", // gold
  "#22c55e", // bright green
  "#16a34a", // medium green
  "#15803d", // deep green
  "#b91c1c", // deep red
  "#854d0e", // deep golden brown
];

function formatAmount(amount: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SpendingByCategoryChart() {
  const [dataByCurrency, setDataByCurrency] = useState<ChartDataByCurrency>({});
  const [loading, setLoading] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const supabase = supabaseBrowserClient;

        const now = new Date();
        const year = now.getFullYear();
        const monthIndex = now.getMonth(); // 0–11

        const monthStart = new Date(
          Date.UTC(year, monthIndex, 1)
        ).toISOString();
        const monthEnd = new Date(
          Date.UTC(year, monthIndex + 1, 1)
        ).toISOString();

        const [{ data: tx, error: txError }, { data: cats, error: catError }] =
          await Promise.all([
            supabase
              .from("transactions")
              .select(
                "category_id, amount_minor, currency_code, type, occurred_at"
              )
              .gte("occurred_at", monthStart)
              .lt("occurred_at", monthEnd),
            supabase.from("categories").select("id, name"),
          ]);

        if (txError) throw txError;
        if (catError) throw catError;

        const transactions = (tx as RawTransaction[]) ?? [];
        const categories = (cats as Category[]) ?? [];

        const categoryMap = new Map<string, string>();
        for (const c of categories) {
          categoryMap.set(c.id, c.name);
        }

        const aggregated: ChartDataByCurrency = {};

        for (const t of transactions) {
          if (t.type !== "expense") continue;

          const currency = t.currency_code || "MIXED";
          const categoryName = t.category_id
            ? categoryMap.get(t.category_id) ?? "Uncategorized"
            : "Uncategorized";

          if (!aggregated[currency]) {
            aggregated[currency] = [];
          }

          const list = aggregated[currency];
          const existing = list.find((p) => p.categoryName === categoryName);

          const amountMajor = t.amount_minor / 100;

          if (existing) {
            existing.totalMajor += amountMajor;
          } else {
            list.push({ categoryName, totalMajor: amountMajor });
          }
        }

        // Sort categories by descending spend for nicer visuals
        for (const currency of Object.keys(aggregated)) {
          aggregated[currency].sort((a, b) => b.totalMajor - a.totalMajor);
        }

        setDataByCurrency(aggregated);

        const currencies = Object.keys(aggregated);
        if (currencies.length > 0 && !activeCurrency) {
          setActiveCurrency(currencies[0]);
        }
      } catch (err) {
        console.error("Failed to load spending chart data", err);
        setError("Failed to load chart data.");
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencies = useMemo(
    () => Object.keys(dataByCurrency),
    [dataByCurrency]
  );

  const activeData =
    (activeCurrency ? dataByCurrency[activeCurrency] : undefined) ?? [];

  // Total for center label
  const activeTotal = useMemo(
    () =>
      activeData.reduce((sum, point) => {
        return sum + point.totalMajor;
      }, 0),
    [activeData]
  );

  return (
    <section className="mt-8 border border-gray-800 rounded-lg bg-black/40 p-4 text-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold">
            This Month&apos;s Spending by Category
          </h2>
          <p className="text-xs text-gray-400">
            Shows total expenses by category for the current month, grouped by
            currency.
          </p>
        </div>

        {currencies.length > 1 && (
          <div className="flex gap-2 text-[11px]">
            {currencies.map((currency) => (
              <button
                key={currency}
                onClick={() => setActiveCurrency(currency)}
                className={`px-3 py-1 rounded border ${
                  activeCurrency === currency
                    ? "border-white text-white"
                    : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {currency}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading chart…</p>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : currencies.length === 0 ? (
        <p className="text-xs text-gray-500">
          No expense transactions recorded this month yet. Add some expenses to
          see the chart.
        </p>
      ) : activeData.length === 0 ? (
        <p className="text-xs text-gray-500">
          No expenses recorded this month for{" "}
          <span className="font-mono">{activeCurrency}</span>.
        </p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={activeData}
                dataKey="totalMajor"
                nameKey="categoryName"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {activeData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="#000000"
                    strokeWidth={1}
                  />
                ))}

                {/* Center label with total + currency */}
                <Label
                  position="center"
                  content={(props) => {
                    const { viewBox } = props;
                    if (!viewBox || typeof viewBox !== "object") return null;
                    const { cx, cy } = viewBox as { cx: number; cy: number };

                    return (
                      <g>
                        <text
                          x={cx}
                          y={cy - 6}
                          textAnchor="middle"
                          fill="#a3a3a3"
                          fontSize={11}
                        >
                          Total {activeCurrency}
                        </text>
                        <text
                          x={cx}
                          y={cy + 10}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={14}
                          fontWeight={600}
                        >
                          {formatAmount(activeTotal)}
                        </text>
                      </g>
                    );
                  }}
                />
              </Pie>
              <Tooltip
                formatter={(value: any) =>
                  typeof value === "number" ? formatAmount(value) : value
                }
                contentStyle={{
                  backgroundColor: "#000000",
                  borderColor: "#262626",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                itemStyle={{
                  color: "#f5f5f5", // value text
                }}
                labelStyle={{
                  color: "#a3a3a3", // label (category name / date)
                }}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{
                  fontSize: 11,
                  color: "#d4d4d4",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
