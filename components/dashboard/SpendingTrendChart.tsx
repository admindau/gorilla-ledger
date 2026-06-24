"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";

type TrendPoint = {
  day: string;
  income: number;
  expense: number;
  currencyCode?: string;
};

type Props = {
  data: TrendPoint[];
};

type ChartPoint = {
  x: number;
  y: number;
  row: TrendPoint & {
    label: string;
    expense: number;
  };
};

function formatDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en", { day: "2-digit", month: "short" });
}

function formatCompactAmount(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function buildLinearPath(points: ChartPoint[]) {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function buildSmoothPath(points: ChartPoint[]) {
  if (points.length < 2) return buildLinearPath(points);

  const command = points.reduce((path, point, index, list) => {
    if (index === 0) return `M ${point.x} ${point.y}`;

    const previous = list[index - 1];
    const beforePrevious = list[index - 2] ?? previous;
    const next = list[index + 1] ?? point;

    const smoothing = 0.18;
    const cp1x = previous.x + (point.x - beforePrevious.x) * smoothing;
    const cp1y = previous.y + (point.y - beforePrevious.y) * smoothing;
    const cp2x = point.x - (next.x - previous.x) * smoothing;
    const cp2y = point.y - (next.y - previous.y) * smoothing;

    return `${path} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
  }, "");

  return command;
}

export default function SpendingTrendChart({ data }: Props) {
  const reactId = useId().replace(/:/g, "");
  const areaFillId = `spending-area-fill-${reactId}`;
  const lineStrokeId = `spending-line-stroke-${reactId}`;
  const lineGlowId = `spending-line-glow-${reactId}`;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const model = useMemo(() => {
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

    const positiveRows = rows.filter((row) => row.expense > 0);
    const maxExpense = Math.max(...rows.map((row) => row.expense), 0);
    const totalExpense = rows.reduce((sum, row) => sum + row.expense, 0);
    const averageExpense = rows.length > 0 ? totalExpense / rows.length : 0;
    const activeDays = positiveRows.length;
    const peakRow = positiveRows.reduce<
      | (TrendPoint & {
          label: string;
          expense: number;
        })
      | null
    >((peak, row) => (!peak || row.expense > peak.expense ? row : peak), null);

    return {
      currencies,
      selectedCurrency,
      rows,
      maxExpense,
      totalExpense,
      averageExpense,
      activeDays,
      peakRow,
    };
  }, [data]);

  const {
    currencies,
    selectedCurrency,
    rows,
    maxExpense,
    totalExpense,
    averageExpense,
    activeDays,
    peakRow,
  } = model;

  if (rows.length === 0 || maxExpense <= 0) {
    return (
      <div className="gl-empty-state rounded-2xl p-6 text-sm">
        No expenses recorded yet for this period.
      </div>
    );
  }

  const width = 880;
  const height = 320;
  const paddingX = 46;
  const paddingTop = 34;
  const paddingBottom = 54;
  const plotHeight = height - paddingTop - paddingBottom;
  const plotWidth = width - paddingX * 2;
  const baselineY = paddingTop + plotHeight;

  const points: ChartPoint[] = rows.map((row, index) => {
    const x =
      rows.length === 1
        ? width / 2
        : paddingX + (index / (rows.length - 1)) * plotWidth;
    const y = baselineY - (row.expense / maxExpense) * plotHeight;
    return { x, y, row };
  });

  const activePoint = points[activeIndex ?? -1] ?? null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

  const peakPoint = peakRow
    ? points.find((point) => point.row.day === peakRow.day) ?? null
    : null;

  const highlightPoints = points.filter((point) => point.row.expense > 0);
  const yTicks = [1, 0.66, 0.33, 0];

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * width;
    const boundedX = Math.max(paddingX, Math.min(width - paddingX, rawX));
    const index =
      rows.length === 1
        ? 0
        : Math.round(((boundedX - paddingX) / plotWidth) * (rows.length - 1));

    setActiveIndex(Math.max(0, Math.min(rows.length - 1, index)));
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Daily spending movement
            </span>
            {peakRow ? (
              <span className="rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-gray-400">
                Peak: {peakRow.label}
              </span>
            ) : null}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {first.label} – {last.label}
            {selectedCurrency ? ` • ${selectedCurrency}` : ""}
            {currencies.length > 1
              ? " • Showing one currency at a time; no FX conversion applied."
              : ""}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[25rem]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
              Total spent
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-white">
              {formatCompactAmount(totalExpense)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
              Daily avg
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-white">
              {formatCompactAmount(averageExpense)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
              Active days
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-white">
              {activeDays}
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.115),transparent_21rem),linear-gradient(180deg,rgba(255,255,255,0.046),rgba(255,255,255,0.012)),rgba(0,0,0,0.74)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_70px_rgba(0,0,0,0.44)]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        <div className="pointer-events-none absolute -left-24 -top-28 h-64 w-64 rounded-full bg-white/[0.055] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Daily spending trend"
          className="relative h-[250px] w-full sm:h-[310px]"
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id={areaFillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
              <stop offset="48%" stopColor="rgba(255,255,255,0.07)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            <linearGradient id={lineStrokeId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.46)" />
              <stop offset="46%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.62)" />
            </linearGradient>

            <filter id={lineGlowId} x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 1  0 1 0 0 1  0 0 1 0 1  0 0 0 0.34 0"
                result="glow"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {yTicks.map((tick) => {
            const y = paddingTop + plotHeight * (1 - tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="rgba(255,255,255,0.075)"
                  strokeDasharray={tick === 0 ? "0" : "4 10"}
                  strokeWidth={tick === 0 ? 1.25 : 1}
                />
                {tick > 0 ? (
                  <text
                    x={width - paddingX}
                    y={y - 8}
                    fill="rgba(255,255,255,0.32)"
                    fontSize="10"
                    textAnchor="end"
                  >
                    {formatCompactAmount(maxExpense * tick)}
                  </text>
                ) : null}
              </g>
            );
          })}

          <path d={areaPath} fill={`url(#${areaFillId})`} opacity="0.92" />

          <path
            d={linePath}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.34"
          />

          <path
            d={linePath}
            fill="none"
            stroke={`url(#${lineStrokeId})`}
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${lineGlowId})`}
          />

          {highlightPoints.map((point) => {
            const isPeak = peakPoint?.row.day === point.row.day;
            return (
              <g key={point.row.day}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isPeak ? 8.5 : 6}
                  fill="rgba(255,255,255,0.10)"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="1"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isPeak ? 4.4 : 3.2}
                  fill="#020202"
                  stroke="white"
                  strokeWidth={isPeak ? 2.4 : 2}
                />
              </g>
            );
          })}

          {activePoint ? (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingTop - 2}
                x2={activePoint.x}
                y2={baselineY}
                stroke="rgba(255,255,255,0.28)"
                strokeDasharray="3 7"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7.5"
                fill="rgba(255,255,255,0.16)"
                stroke="rgba(255,255,255,0.38)"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3.8"
                fill="white"
              />
            </g>
          ) : null}

          {rows.length > 1 ? (
            <>
              <text
                x={paddingX}
                y={height - 18}
                fill="rgba(255,255,255,0.48)"
                fontSize="12"
                letterSpacing="1.8"
              >
                {first.label}
              </text>
              <text
                x={width - paddingX}
                y={height - 18}
                fill="rgba(255,255,255,0.48)"
                fontSize="12"
                letterSpacing="1.8"
                textAnchor="end"
              >
                {last.label}
              </text>
            </>
          ) : null}

          <rect
            x={paddingX}
            y={paddingTop}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
          />
        </svg>

        {activePoint ? (
          <div
            className="pointer-events-none absolute top-5 z-10 min-w-[9rem] rounded-2xl border border-white/15 bg-black/85 px-3.5 py-3 text-xs shadow-[0_18px_60px_rgba(0,0,0,0.62)] backdrop-blur-xl"
            style={{
              left: `calc(${(activePoint.x / width) * 100}% - ${
                activePoint.x > width * 0.72 ? 150 : 20
              }px)`,
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
              {activePoint.row.label}
            </div>
            <div className="mt-1 flex items-end gap-1">
              <span className="text-lg font-semibold leading-none text-white tabular-nums">
                {formatCompactAmount(activePoint.row.expense)}
              </span>
              {selectedCurrency ? (
                <span className="text-[10px] font-medium uppercase text-gray-500">
                  {selectedCurrency}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              Daily expense movement
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
