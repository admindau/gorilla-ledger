"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";

type Wallet = {
  id: string;
  name: string;
  currency_code: string;
};

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

const CATEGORY_COLORS: Record<string, string[]> = {
  USD: ["#F97373", "#FDBA74", "#FACC15", "#4ADE80", "#38BDF8", "#A855F7", "#F472B6"],
  SSP: ["#FB7185", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#6366F1", "#EC4899"],
  KES: ["#F97373", "#FBBF24", "#22C55E", "#2DD4BF", "#818CF8", "#E879F9", "#F9A8D4"],
};

export default function SpendingByCategoryChart() {
  const { showToast } = useToast();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [activeCurrency, setActiveCurrency] = useState<Currency>("SSP");
  const [loading, setLoading] = useState(true);

  // ⬇️ categories removed (was unused)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const supabase = supabaseBrowserClient;

        const [{ data: w }, { data: rows }] = await Promise.all([
          supabase.from("wallets").select("id,name,currency_code").order("name", { ascending: true }),
          supabase.from("category_spending_current_month").select("*"),
        ]);

        setWallets(w ?? []);
        setRawData(rows ?? []);
      } catch (error) {
        console.error("Error loading spending by category:", error);
        showToast("Failed to load spending data.", "error");
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
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [rawData, activeCurrency]);

  const hasData = chartData.length > 0;
  const legendItems = chartData.slice(0, 7);

  const currentCurrencyWallets = useMemo(
    () => wallets.filter((w) => w.currency_code === activeCurrency),
    [wallets, activeCurrency]
  );

  const activeData = useMemo(() => {
    if (!hasData) return [];
    return chartData.slice(0, 7);
  }, [chartData, hasData]);

  const colorsForCurrency = CATEGORY_COLORS[activeCurrency] ?? CATEGORY_COLORS.USD;

  return (
    <section className="border border-gray-900 rounded-lg bg-black/50 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold">This Month&apos;s Spending by Category</h2>
          <p className="text-[11px] text-gray-400">Shows total expenses by category for the current month, grouped by currency.</p>
        </div>
        <div className="inline-flex rounded-full border border-gray-800 bg-black/60 p-0.5 text-[11px]">
          {(["SSP", "USD", "KES"] as Currency[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setActiveCurrency(code)}
              className={`px-2 py-0.5 rounded-full ${activeCurrency === code ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {!currentCurrencyWallets.length ? (
        <p className="text-xs text-gray-500">
          You don&apos;t have any wallets with currency <span className="font-mono">{activeCurrency}</span> yet.
        </p>
      ) : !hasData ? (
        <p className="text-xs text-gray-500">No expenses recorded yet for <span className="font-mono">{activeCurrency}</span> this month.</p>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-8">
          <div className="h-[260px] lg:flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activeData}
                  dataKey="totalAmount"
                  nameKey="categoryName"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  stroke="#020617"
                  strokeWidth={2}
                >
                  {activeData.map((entry, index) => (
                    <Cell
                      key={entry.categoryId ?? `uncat-${index}`}
                      fill={colorsForCurrency[index % colorsForCurrency.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string) =>
                    typeof value === "number"
                      ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : value
                  }
                  contentStyle={{
                    backgroundColor: "#020617",
                    borderColor: "#1f2937",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 lg:mt-0 lg:w-48 space-y-1">
            {legendItems.map((item, index) => (
              <div key={item.categoryId ?? `uncat-leg-${index}`} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: colorsForCurrency[index % colorsForCurrency.length],
                    }}
                  />
                  <span className="text-gray-300 truncate max-w-[120px]">{item.categoryName}</span>
                </div>
                <span className="font-mono text-gray-400 ml-2">
                  {item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currencyCode}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="mt-2 text-[11px] text-gray-500">Loading chart data…</p>}
    </section>
  );
}
