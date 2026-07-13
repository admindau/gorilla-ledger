"use client";

import { useEffect, useMemo, useState } from "react";
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
import StableChartContainer from "@/components/charts/StableChartContainer";
import ChartTooltip from "@/components/charts/ChartTooltip";
import ChartLegend from "@/components/charts/ChartLegend";
import { chartMargins, chartTheme } from "@/components/charts/chartTheme";
import {
  formatCompactAxisValue,
  formatMonthlyAxisLabel,
  formatMonthlyTooltipLabel,
  getAdaptiveTickGap,
} from "@/components/charts/chartUtils";

type Point = {
  // incoming shape (daily or monthly)
  day?: string; // "2025-11-18"
  date?: string; // alternative
  month?: string; // "2025-11"
  income: number;
  expense: number;
  currencyCode?: string | null;
  currency?: string | null;
};

type FullHistoryIncomeExpenseChartProps = {
  data: Point[];
};

function getCurrency(row: Point): string {
  return (row.currencyCode ?? row.currency ?? "") || "";
}

// Use day/date if present, otherwise month
function getRawDate(row: Point): string {
  return row.day ?? row.date ?? row.month ?? "";
}

// For monthly buckets: YYYY-MM (from day or pre-existing month)
function getMonthKey(row: Point): string {
  const raw = getRawDate(row);
  if (!raw) return "";
  const parts = raw.split("-");
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  }
  return raw;
}


export default function FullHistoryIncomeExpenseChart({
  data,
}: FullHistoryIncomeExpenseChartProps) {
  const hasRawData = Array.isArray(data) && data.length > 0;

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const row of data) {
      const code = getCurrency(row);
      if (code) set.add(code);
    }
    return Array.from(set).sort();
  }, [data]);

  const hasCurrencyInfo = currencies.length > 0;

  const [activeCurrency, setActiveCurrency] = useState<string | null>(
    hasCurrencyInfo ? currencies[0] : null
  );

  // Best practice: keep activeCurrency valid when data/filters change
  useEffect(() => {
    if (!hasCurrencyInfo) {
      if (activeCurrency !== null) setActiveCurrency(null);
      return;
    }

    if (!activeCurrency || !currencies.includes(activeCurrency)) {
      setActiveCurrency(currencies[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCurrencyInfo, currencies.join("|")]);

  const chartData = useMemo(() => {
    if (!hasRawData) return [];

    let filtered = data;
    if (hasCurrencyInfo && activeCurrency) {
      filtered = data.filter((row) => getCurrency(row) === activeCurrency);
    }

    // Aggregate per month
    const buckets = new Map<
      string,
      { label: string; income: number; expense: number; currencyCode?: string }
    >();

    for (const row of filtered) {
      const key = getMonthKey(row);
      if (!key) continue;

      const existing = buckets.get(key) ?? {
        label: key,
        income: 0,
        expense: 0,
        currencyCode: getCurrency(row) || undefined,
      };

      existing.income += row.income ?? 0;
      existing.expense += row.expense ?? 0;
      buckets.set(key, existing);
    }

    const aggregated = Array.from(buckets.values());
    aggregated.sort((a, b) => a.label.localeCompare(b.label));
    return aggregated;
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">All-Time Income vs Expenses</h2>
          <p className="text-xs text-gray-400">
            Monthly totals across your full transaction history. Use the
            currency toggle to focus on one currency at a time.
          </p>
        </div>

        {hasCurrencyInfo && (
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

      {!hasData ? (
        <p className="text-xs text-gray-500">
          No transactions yet to build an all-time view.
        </p>
      ) : (
        <StableChartContainer className="gl-card gl-chart-surface h-80 min-h-80 w-full p-4">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={chartData} margin={chartMargins.line}>
              <CartesianGrid
                vertical={false}
                strokeDasharray="4 8"
                stroke={chartTheme.gridStroke}
              />

              <XAxis
                dataKey="label"
                tickFormatter={(value) => formatMonthlyAxisLabel(String(value))}
                tick={{ fontSize: 10, fill: chartTheme.tickFill }}
                axisLine={{ stroke: chartTheme.axisStroke }}
                tickLine={false}
                minTickGap={getAdaptiveTickGap(chartData.length)}
                interval="preserveStartEnd"
                padding={{ left: 8, right: 8 }}
              />

              <YAxis
                tick={{ fontSize: 10, fill: chartTheme.tickFill }}
                axisLine={{ stroke: chartTheme.axisStroke }}
                tickLine={false}
                tickFormatter={(v) => formatCompactAxisValue(Number(v))}
              />

              <Tooltip
                wrapperStyle={chartTheme.tooltipWrapper}
                content={                    
                  <ChartTooltip
                    labelFormatter={(label) =>
                      formatMonthlyTooltipLabel(String(label))
                    }
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
                  />
                }
              />

              <Legend
                verticalAlign="bottom"
                height={34}
                content={<ChartLegend />}
              />

              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke={chartTheme.lineIncome}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "#050505" }}
                isAnimationActive
                animationDuration={650}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expenses"
                stroke={chartTheme.lineExpense}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "#050505" }}
                isAnimationActive
                animationDuration={650}
              />
            </LineChart>
          </ResponsiveContainer>
        </StableChartContainer>
      )}
    </section>
  );
}
