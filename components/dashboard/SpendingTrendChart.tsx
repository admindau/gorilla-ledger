"use client";

type TrendPoint = {
  day: string;
  income: number;
  expense: number;
  currencyCode?: string;
};

type Props = {
  data: TrendPoint[];
};

function formatDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en", { day: "2-digit", month: "short" });
}

function buildPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export default function SpendingTrendChart({ data }: Props) {
  const currencies = Array.from(
    new Set(data.map((row) => row.currencyCode).filter(Boolean))
  ).sort();

  const selectedCurrency = currencies[0] ?? data[0]?.currencyCode ?? "";
  const filtered = selectedCurrency
    ? data.filter((row) => row.currencyCode === selectedCurrency)
    : data;

  const rows = filtered
    .map((row) => ({
      ...row,
      label: formatDay(row.day),
      expense: Number(row.expense || 0),
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const maxExpense = Math.max(...rows.map((row) => row.expense), 0);
  const totalExpense = rows.reduce((sum, row) => sum + row.expense, 0);
  const averageExpense = rows.length > 0 ? totalExpense / rows.length : 0;

  if (rows.length === 0 || maxExpense <= 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
        No expenses recorded yet for this period.
      </div>
    );
  }

  const width = 720;
  const height = 260;
  const paddingX = 28;
  const paddingTop = 22;
  const paddingBottom = 42;
  const plotHeight = height - paddingTop - paddingBottom;
  const plotWidth = width - paddingX * 2;

  const points = rows.map((row, index) => {
    const x =
      rows.length === 1
        ? width / 2
        : paddingX + (index / (rows.length - 1)) * plotWidth;
    const y =
      paddingTop + plotHeight - (row.expense / maxExpense) * plotHeight;
    return { x, y };
  });

  const path = buildPath(points);
  const last = rows[rows.length - 1];
  const first = rows[0];

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium">Daily spending movement</div>
          <div className="text-xs text-gray-500">
            {first.label} – {last.label}
            {selectedCurrency ? ` • ${selectedCurrency}` : ""}
            {currencies.length > 1
              ? " • Showing one currency at a time; no FX conversion applied."
              : ""}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:text-right">
          <div className="rounded-xl border border-gray-800 bg-black/30 px-3 py-2">
            <div className="text-gray-500">Total spent</div>
            <div className="font-semibold tabular-nums">
              {totalExpense.toFixed(2)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-black/30 px-3 py-2">
            <div className="text-gray-500">Daily average</div>
            <div className="font-semibold tabular-nums">
              {averageExpense.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-gray-800 bg-black/30">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Daily spending trend"
          className="h-[240px] w-full sm:h-[280px]"
          preserveAspectRatio="none"
        >
          <line
            x1={paddingX}
            y1={paddingTop + plotHeight}
            x2={width - paddingX}
            y2={paddingTop + plotHeight}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={paddingTop}
            x2={width - paddingX}
            y2={paddingTop}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <path
            d={path}
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <circle
              key={`${rows[index].day}-${index}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="black"
              stroke="white"
              strokeWidth="2"
            />
          ))}
          {rows.length > 1 && (
            <>
              <text
                x={paddingX}
                y={height - 16}
                fill="rgba(255,255,255,0.55)"
                fontSize="12"
              >
                {first.label}
              </text>
              <text
                x={width - paddingX}
                y={height - 16}
                fill="rgba(255,255,255,0.55)"
                fontSize="12"
                textAnchor="end"
              >
                {last.label}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
