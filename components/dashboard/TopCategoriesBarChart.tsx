"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import StableChartContainer from "@/components/charts/StableChartContainer";
import ChartTooltip from "@/components/charts/ChartTooltip";
import { chartMargins, chartTheme } from "@/components/charts/chartTheme";

import { isInternalTransfer } from "@/lib/transactions/classification";
import { getCalendarDateParts } from "@/lib/dashboard/chartReconciliation";

type TransactionType = "income" | "expense";

type Transaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

type Props = {
  transactions: Transaction[];
  categories: Category[];
  walletFilter: string;   // "all" or wallet id
  categoryFilter: string; // "all" or category id
  yearFilter: string;     // "all" or specific year like "2025"
};


type ChartPoint = {
  name: string;
  value: number;       // major units
};

type DataByCurrency = Record<string, ChartPoint[]>;

export default function TopCategoriesBarChart({
  transactions,
  categories,
  walletFilter,
  categoryFilter,
  yearFilter,
}: Props) {
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c] as const)),
    [categories]
  );

  const currentYear = new Date().getFullYear();
  const targetYear =
    yearFilter === "all"
      ? currentYear
      : Number.parseInt(yearFilter, 10) || currentYear;

  // Build "top 5 categories per currency" for the chosen year & filters
  const dataByCurrency: DataByCurrency = useMemo(() => {
    const sums: Record<string, Record<string, number>> = {};

    for (const tx of transactions) {
      const calendar = getCalendarDateParts(tx.occurred_at);
      if (!calendar) continue;
      if (calendar.year !== targetYear) continue;

      if (tx.type !== "expense") continue;
      if (!tx.category_id) continue;

      if (walletFilter !== "all" && tx.wallet_id !== walletFilter) continue;
      if (categoryFilter !== "all" && tx.category_id !== categoryFilter) {
        continue;
      }

      const category = tx.category_id ? categoryMap[tx.category_id] : null;
      if (isInternalTransfer(tx, category)) continue;

      const currency = tx.currency_code;
      if (!sums[currency]) sums[currency] = {};
      if (!sums[currency][tx.category_id]) sums[currency][tx.category_id] = 0;
      sums[currency][tx.category_id] += tx.amount_minor;
    }

    const result: DataByCurrency = {};

    for (const [currency, catMap] of Object.entries(sums)) {
      const topFive = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([categoryId, totalMinor]) => ({
          name: categoryMap[categoryId]?.name ?? "Uncategorized",
          value: totalMinor / 100, // convert to major units
        }));

      result[currency] = topFive;
    }

    return result;
  }, [
    transactions,
    categoryMap,
    walletFilter,
    categoryFilter,
    targetYear,
  ]);

  const currencyCodes = useMemo(
    () => Object.keys(dataByCurrency).sort(),
    [dataByCurrency]
  );

  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);

  // Keep active currency in sync with available data
  useEffect(() => {
    if (currencyCodes.length === 0) {
      setActiveCurrency(null);
      return;
    }
    if (!activeCurrency || !currencyCodes.includes(activeCurrency)) {
      setActiveCurrency(currencyCodes[0]);
    }
  }, [currencyCodes, activeCurrency]);

  const dataForChart: ChartPoint[] = useMemo(() => {
    if (!activeCurrency) return [];
    return dataByCurrency[activeCurrency] ?? [];
  }, [dataByCurrency, activeCurrency]);

  const hasData = dataForChart.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            Top Spending Categories – This Year
          </h3>
          <p className="text-[11px] text-gray-400">
            Highest expense categories for the selected year and filters.
            Amounts are shown in major units (no FX conversion). Use the toggle
            to switch between currencies.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Currency:</span>
          {currencyCodes.length === 0 ? (
            <span className="text-gray-500">No data</span>
          ) : (
            <div className="inline-flex rounded-full border border-gray-700 bg-black/60 p-1">
              {currencyCodes.map((code) => {
                const active = code === activeCurrency;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setActiveCurrency(code)}
                    className={`px-3 py-0.5 rounded-full text-[11px] ${
                      active
                        ? "bg-white text-black"
                        : "text-gray-300 hover:bg-gray-900"
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <StableChartContainer className="h-72 min-h-72 w-full min-w-0">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No expense data for this year with the current filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart
              data={dataForChart}
              margin={chartMargins.compactBar}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.gridStroke}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: chartTheme.tickFillStrong }}
                tickMargin={8}
                interval={0}
                angle={-32}
                textAnchor="end"
                height={58}
              />
              <YAxis
                tick={{ fontSize: 11, fill: chartTheme.tickFill }}
                tickMargin={6}
              />
              <Tooltip
                wrapperStyle={chartTheme.tooltipWrapper}
                cursor={{ fill: chartTheme.cursorFill }}
                content={
                  <ChartTooltip
                    valueFormatter={(value) => {
                      const numeric =
                        typeof value === "number" ? value : Number(value ?? 0);

                      return Number.isNaN(numeric)
                        ? String(value ?? "")
                        : numeric.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          });
                    }}
                    nameFormatter={() => "Total spent"}
                  />
                }
              />
              <Bar
                dataKey="value"
                radius={[8, 8, 0, 0]}
                fill={chartTheme.barPrimary}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </StableChartContainer>
    </div>
  );
}
