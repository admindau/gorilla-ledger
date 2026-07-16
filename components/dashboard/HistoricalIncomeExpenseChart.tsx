"use client";

import { useMemo, useState } from "react";
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
import AccessibleChartSummary from "@/components/charts/AccessibleChartSummary";
import ChartTooltip from "@/components/charts/ChartTooltip";
import ChartLegend from "@/components/charts/ChartLegend";
import { chartMargins, chartTheme } from "@/components/charts/chartTheme";
import {
  formatCompactAxisValue,
  formatDailyAxisLabel,
  formatDailyTooltipLabel,
  getAdaptiveTickGap,
} from "@/components/charts/chartUtils";

type HistoricalPoint = {
  month?: string; // legacy
  day?: string; // preferred: "2025-11-01"
  date?: string; // alternative
  income: number;
  expense: number;
  currencyCode?: string;
  currency?: string;
};

type HistoricalIncomeExpenseChartProps = {
  data: HistoricalPoint[];
};

function getCurrency(row: HistoricalPoint): string {
  return row.currencyCode ?? row.currency ?? "";
}

function getDateLabel(row: HistoricalPoint): string {
  return row.day ?? row.date ?? row.month ?? "";
}


function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function HistoricalIncomeExpenseChart({
  data,
}: HistoricalIncomeExpenseChartProps) {
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

  const [currencyPreference, setActiveCurrency] = useState<string | null>(null);
  const activeCurrency =
    currencyPreference && currencies.includes(currencyPreference)
      ? currencyPreference
      : currencies[0] ?? null;

  const chartData = useMemo(() => {
    if (!hasRawData) return [];

    const filtered =
      hasCurrencyInfo && activeCurrency
        ? data.filter((row) => getCurrency(row) === activeCurrency)
        : data;

    const withLabels = filtered
      .map((row) => ({
        ...row,
        label: getDateLabel(row),
      }))
      .filter((row) => row.label);

    withLabels.sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );

    return withLabels;
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  const accessibleSummary = useMemo(() => {
    if (!hasData) return "Historical income versus expenses for the last 12 months: no data is available for the current filters.";
    const totalIncome = chartData.reduce((sum, row) => sum + Number(row.income || 0), 0);
    const totalExpense = chartData.reduce((sum, row) => sum + Number(row.expense || 0), 0);
    const currencyLabel = activeCurrency ? ` in ${activeCurrency}` : "";
    const firstLabel = String(chartData[0]?.label ?? "");
    const lastLabel = String(chartData[chartData.length - 1]?.label ?? "");
    return `Historical income versus expenses for the last 12 months${currencyLabel} from ${firstLabel} to ${lastLabel}. Total income ${formatNumber(totalIncome)}; total expenses ${formatNumber(totalExpense)}.`;
  }, [hasData, chartData, activeCurrency]);

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">
            Historical Income vs Expenses – Last 12 Months
          </h2>
          <p className="text-xs text-gray-400">
            Daily totals across the last 12 months. When currency metadata is
            present, you can focus on one currency at a time using the toggle.
          </p>
        </div>

        {hasCurrencyInfo && (
          <div className="inline-flex rounded-full border border-gray-800 bg-black/60 p-0.5 text-[11px]"
            role="group"
            aria-label="Historical income and expense currency">
            {currencies.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setActiveCurrency(code)}
                aria-pressed={activeCurrency === code}
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
          Not enough data yet to show a 12-month trend.
        </p>
      ) : (
        <>
          <AccessibleChartSummary summary={accessibleSummary} status="polite" />
          <StableChartContainer
            className="gl-card gl-chart-surface h-80 min-h-80 w-full p-4"
            ariaLabel={accessibleSummary}
          >
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={1}
            minHeight={1}
            initialDimension={{ width: 800, height: 320 }}
          >
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
        </>
      )}
    </section>
  );
}
