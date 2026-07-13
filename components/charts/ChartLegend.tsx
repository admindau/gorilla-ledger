"use client";

type LegendEntry = {
  color?: string;
  value?: string | number;
  dataKey?: string | number;
};

type ChartLegendProps = {
  payload?: LegendEntry[];
};

export default function ChartLegend({ payload = [] }: ChartLegendProps) {
  if (payload.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
      {payload.map((entry, index) => (
        <span
          key={`${String(entry.dataKey ?? entry.value ?? "series")}-${index}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-medium text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: entry.color ?? "rgba(255,255,255,0.8)" }}
          />
          {String(entry.value ?? entry.dataKey ?? "Series")}
        </span>
      ))}
    </div>
  );
}
