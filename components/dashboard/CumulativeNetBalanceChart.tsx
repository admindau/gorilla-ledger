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

type Point = {
  day?: string; // "2025-11-18"
  date?: string; // alternative
  month?: string; // "2025-11"
  income: number;
  expense: number;
  currencyCode?: string | null;
  currency?: string | null;
};

type CumulativeNetBalanceChartProps = {
  data: Point[];
};

function getCurrency(row: Point): string {
  return (row.currencyCode ?? row.currency ?? "") || "";
}

function getRawDate(row: Point): string {
  return row.day ?? row.date ?? row.month ?? "";
}


function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CumulativeNetBalanceChart({
  data,
}: CumulativeNetBalanceChartProps) {
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

    // Group by date (daily preferred), compute cumulative net FLOW
    const perDate = new Map<string, { label: string; net: number }>();

    for (const row of filtered) {
      const key = getRawDate(row);
      if (!key) continue;

      const existing = perDate.get(key) ?? { label: key, net: 0 };

      const income = row.income ?? 0;
      const expense = row.expense ?? 0;

      // Net flow for the day: income - expense
      existing.net += income - expense;

      perDate.set(key, existing);
    }

    const sorted = Array.from(perDate.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    let running = 0;
    return sorted.map((row) => {
      running += row.net;
      return {
        label: row.label,
        net: row.net,
        cumulativeNetFlow: running,
      };
    });
  }, [data, hasRawData, hasCurrencyInfo, activeCurrency]);

  const hasData = chartData.length > 0;

  const accessibleSummary = useMemo(() => {
    if (!hasData) return "Cumulative net flow: no data is available for the current filters.";
    const currencyLabel = activeCurrency ? ` in ${activeCurrency}` : "";
    const firstLabel = String(chartData[0]?.label ?? "");
    const lastLabel = String(chartData[chartData.length - 1]?.label ?? "");
    const finalValue = Number(chartData[chartData.length - 1]?.cumulativeNetFlow ?? 0);
    return `Cumulative net flow${currencyLabel} from ${firstLabel} to ${lastLabel}. Final cumulative net flow is ${formatNumber(finalValue)}.`;
  }, [hasData, chartData, activeCurrency]);

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">
            Cumulative Net Flow — All Time
          </h2>
          <p className="text-xs text-gray-400">
            Income minus expenses accumulated over time. This reflects net flow
            (not wallet balances) and does not include starting balances.
          </p>
        </div>

        {hasCurrencyInfo && (
          <div className="inline-flex rounded-full border border-gray-800 bg-black/60 p-0.5 text-[11px]"
            role="group"
            aria-label="Cumulative net flow currency">
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
          No transactions yet to build a cumulative net flow view.
        </p>
      ) : (
        <>
          <AccessibleChartSummary summary={accessibleSummary} status="polite" />
          <StableChartContainer
            className="gl-card gl-chart-surface h-80 min-h-80 w-full p-4"
            ariaLabel={accessibleSummary}
          >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={chartData} margin={chartMargins.line}>
              <CartesianGrid
                vertical={false}
                strokeDasharray="4 8"
                stroke={chartTheme.gridStroke}
              />

              <XAxis
                dataKey="label"
                tickFormatter={(value) => formatDailyAxisLabel(String(value))}
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
                      const numeric =
                        typeof value === "number" ? value : Number(value ?? 0);

                      return Number.isNaN(numeric)
                        ? String(value ?? "")
                        : formatNumber(numeric);
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
                dataKey="cumulativeNetFlow"
                name="Cumulative net flow"
                stroke={chartTheme.lineIncome}
                strokeWidth={2.2}
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
