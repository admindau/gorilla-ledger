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
import { useToast } from "@/components/ui/ToastProvider";

type RawRow = {
  category_id: string | null;
  category_name: string | null;
  wallet_currency_code: string;
  total_amount_minor: number;
};

type ChartDatum = {
  categoryId: string | null;
  categoryName: string;
  currencyCode: string;
  totalAmount: number;
};

type Currency = "USD" | "SSP" | "KES";

const BAR_COLORS: Record<Currency, string> = {
  USD: "#22C55E",
  SSP: "#F97373",
  KES: "#FACC15",
};

export default function TopCategoriesBarChart() {
  const { showToast } = useToast();
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [activeCurrency, setActiveCurrency] = useState<Currency>("SSP");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const supabase = supabaseBrowserClient;

        const { data: rows, error } = await supabase
          .from("category_spending_current_month")
          .select("*");

        if (error) throw error;

        setRawData(rows ?? []);
      } catch (error) {
        console.error("Error loading top categories:", error);
        showToast("Failed to load top spending categories.", "error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [showToast]);

  const chartData = useMemo<ChartDatum[]>(() => {
    if (!rawData.length) return [];

    return rawData
      .filter((row) => row.wallet_currency_code === activeCurrency)
      .map((row) => ({
        categoryId: row.category_id,
        categoryName: row.category_name ?? "Uncategorized",
        currencyCode: row.wallet_currency_code,
        totalAmount: row.total_amount_minor / 100,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
  }, [rawData, activeCurrency]);

  const hasData = chartData.length > 0;
  const barColor = BAR_COLORS[activeCurrency] ?? "#22C55E";

  return (
    <section className="border border-gray-900 rounded-lg bg-black/50 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold">
            Top Spending Categories – This Month
          </h2>
          <p className="text-[11px] text-gray-400">
            Highest expense categories for the current month (top five per
            currency).
          </p>
        </div>
        <div className="inline-flex rounded-full border border-gray-800 bg-black/60 p-0.5 text-[11px]">
          {(["SSP", "USD", "KES"] as Currency[]).map((code) => (
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
      </div>

      {!hasData ? (
        <p className="text-xs text-gray-500">
          No expenses recorded yet for{" "}
          <span className="font-mono">{activeCurrency}</span> this month. Record
          some transactions to see top categories.
        </p>
      ) : (
        <div className="h-[260px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
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
              <Bar dataKey="totalAmount" radius={[4, 4, 0, 0]} fill={barColor} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading && (
        <p className="mt-2 text-[11px] text-gray-500">Loading chart data…</p>
      )}
    </section>
  );
}
