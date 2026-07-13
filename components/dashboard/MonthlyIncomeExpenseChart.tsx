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
  formatDailyAxisLabel,
  formatDailyTooltipLabel,
  getAdaptiveTickGap,
} from "@/components/charts/chartUtils";

type TimeSeriesPoint = {
  // we support multiple possible keys so the component is flexible
  month?: string; // legacy: "2025-11"
  day?: string; // new: "2025-11-01"
  date?: string; // alternative: "2025-11-01"
  income: number; // major units
  expense: number; // major units
  currencyCode?: string;
  currency?: string;
};

type MonthlyIncomeExpenseChartProps = {
  data: TimeSeriesPoint[];
};

function getCurrency(row: TimeSeriesPoint): string {
  return row.currencyCode ?? row.currency ?? "";
}

function getDateLabel(row: TimeSeriesPoint): string {
  return row.day ?? row.date ?? row.month ?? "";
}


function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function MonthlyIncomeExpenseChart({
  data,
}: MonthlyIncomeExpenseChartProps) {
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

  /**
   * Best practice: if the dataset changes (e.g., month navigation),
   * ensure the active currency remains valid.
   */
  useEffect(() => {
    if (!hasCurrencyInfo) {
      if (activeCurrency !== null) setActiveCurrency(null);
      return;
    }

    // If active is missing/invalid, fall back to first available.
    if (!activeCurrency || !currencies.includes(activeCurrency)) {
      setActiveCurrency(currencies[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCurrencyInfo, currencies.join("|")]);

  const chartData = useMemo(() => {
    if (!hasRawData) return [];

    const filtered =
      hasCurrencyInfo && activeCurrency
        ? data.filter((row) => getCurrency(row) === activeCurrency)
        : data;

    const withLabels = filtered
      .map((row) => ({
        ...row, // IMPORTANT: spread row (fixes the ".row" issue)
        label: getDateLabel(row),
      }))
      .filter((row) => row.label);

    // Sort by label (YYYY-MM-DD sorts correctly lexicographically)
    withLabels.sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );

    return withLabels;
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;


  return (
    <section className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">Monthly Income vs Expenses</h2>
          <p className="text-xs text-gray-400">
            Daily totals across your transactions. When currency metadata is
            available, use the toggle to focus on one currency at a time.
            Internal transfers should already be excluded by the upstream
            aggregation.
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
          No transactions yet to build this trend.
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
                tickFormatter={(v) => formatDailyAxisLabel(String(v))}
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
                      formatDailyTooltipLabel(String(label))
                    }
                    valueFormatter={(value) => {
                      if (value == null) return "";

                      const numeric =
                        typeof value === "number" ? value : Number(value);

                      return Number.isNaN(numeric) ? String(value) : formatNumber(numeric);
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
