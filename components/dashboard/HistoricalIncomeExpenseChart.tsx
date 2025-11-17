"use client";

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

type HistoricalPoint = {
  month: string;   // e.g. "2025-01"
  income: number;  // major units
  expense: number; // major units
};

type HistoricalIncomeExpenseChartProps = {
  data: HistoricalPoint[];
};

export default function HistoricalIncomeExpenseChart({
  data,
}: HistoricalIncomeExpenseChartProps) {
  const hasData = data && data.length > 0;

  if (!hasData) {
    return (
      <div className="h-72 flex items-center justify-center text-xs text-gray-500">
        No historical data to display yet.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#374151" }}
            tickLine={{ stroke: "#374151" }}
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
            formatter={(value: number | string) => {
              if (typeof value === "number") {
                return value.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
              }
              const parsed = Number(value);
              if (!Number.isNaN(parsed)) {
                return parsed.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
              }
              return value;
            }}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Legend
            wrapperStyle={{
              fontSize: 11,
              color: "#d1d5db",
            }}
          />
          <Line
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="#22c55e" // green (Rasta)
            strokeWidth={1.8}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="expense"
            name="Expenses"
            stroke="#ef4444" // red (Rasta)
            strokeWidth={1.8}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
