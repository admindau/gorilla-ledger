"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type TxRow = {
  amount_minor: number;
  type: "income" | "expense";
  currency_code: string;
  category_id: string | null;
  occurred_at: string;
};

type Category = {
  id: string;
  name: string;
};

type CategoryPoint = {
  categoryName: string;
  total: number;
};

type CurrencyBucket = {
  currency: string;
  categories: CategoryPoint[];
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

function buildBuckets(
  rows: TxRow[],
  categories: Category[]
): CurrencyBucket[] {
  const byCurrency: Record<string, Record<string, number>> = {};
  const categoryMap = new Map<string, string>();

  categories.forEach((c) => categoryMap.set(c.id, c.name));

  for (const row of rows) {
    if (row.type !== "expense") continue;
    if (!row.category_id) continue;

    const currency = row.currency_code;
    const categoryId = row.category_id;

    if (!byCurrency[currency]) byCurrency[currency] = {};
    if (!byCurrency[currency][categoryId]) byCurrency[currency][categoryId] = 0;

    const major = row.amount_minor / 100;
    byCurrency[currency][categoryId] += major;
  }

  return Object.entries(byCurrency).map(([currency, byCategory]) => {
    const categoriesPoints: CategoryPoint[] = Object.entries(byCategory)
      .map(([catId, total]) => ({
        categoryName: categoryMap.get(catId) ?? "Unknown",
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return { currency, categories: categoriesPoints };
  });
}

export default function TopCategoriesBarChart() {
  const [buckets, setBuckets] = useState<CurrencyBucket[]>([]);
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

        const [
          { data: txData, error: txError },
          { data: catData, error: catError },
        ] = await Promise.all([
          supabaseBrowserClient
            .from("transactions")
            .select(
              "amount_minor,type,currency_code,category_id,occurred_at"
            )
            .gte("occurred_at", startIso)
            .lt("occurred_at", endIso),
          supabaseBrowserClient.from("categories").select("id,name"),
        ]);

        if (txError || catError) {
          console.error("Failed to load top categories", txError || catError);
          if (!cancelled) {
            setError("Unable to load top spending categories.");
          }
          return;
        }

        const rows = (txData ?? []) as TxRow[];
        const categories = (catData ?? []) as Category[];
        const built = buildBuckets(rows, categories);

        if (!cancelled) {
          setBuckets(built);
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

  const activeBucket = useMemo(
    () => buckets.find((b) => b.currency === activeCurrency),
    [buckets, activeCurrency]
  );

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-1">
        Top Spending Categories – This Month
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Highest expense categories for the current month (top five per currency).
      </p>

      <div className="flex justify-end gap-2 mb-4">
        {buckets.map((b) => (
          <button
            key={b.currency}
            type="button"
            onClick={() => setActiveCurrency(b.currency)}
            className={`px-3 py-1 rounded-full text-[11px] border transition ${
              activeCurrency === b.currency
                ? "bg-white text-black border-white"
                : "border-gray-700 text-gray-300 hover:bg-gray-900"
            }`}
          >
            {b.currency}
          </button>
        ))}
      </div>

      <div className="border border-gray-800 rounded-lg bg-black/40 p-4 h-72">
        {loading ? (
          <p className="text-xs text-gray-500">Loading categories…</p>
        ) : error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : !activeBucket || activeBucket.categories.length === 0 ? (
          <p className="text-xs text-gray-500">
            No expense transactions recorded for this month yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activeBucket.categories}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111827" />
              <XAxis
                dataKey="categoryName"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#374151" }}
                tickLine={{ stroke: "#374151" }}
                interval={0}
                tickFormatter={(value: string) =>
                  value.length > 10 ? value.slice(0, 9) + "…" : value
                }
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
              <Bar dataKey="total" fill="#ffffff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
