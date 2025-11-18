"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type TopCategoryPoint = {
  name: string;
  value: number; // already in major units (e.g. 112.08)
};

type Props = {
  data: TopCategoryPoint[];
};

export default function TopCategoriesBarChart({ data }: Props) {
  const hasData = data && data.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">
          Top Spending Categories – This Year
        </h3>
        <p className="text-[11px] text-gray-400">
          Highest expense categories based on the current dashboard filters.
          Amounts are shown in major units (no FX conversion).
        </p>
      </div>

      <div className="h-72 w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No expense data for this period with the current filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, bottom: 25, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1f2937"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#d1d5db" }}
                tickMargin={8}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickMargin={6}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid #1f2937",
                  fontSize: 11,
                  color: "#e5e7eb",
                }}
                formatter={(value: any) => [
                  (value as number).toFixed(2),
                  "total",
                ]}
              />
              {/* 🔥 Explicit bright bar colour so it pops on black */}
              <Bar
                dataKey="value"
                radius={[8, 8, 0, 0]}
                fill="#22c55e" // bright green
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
