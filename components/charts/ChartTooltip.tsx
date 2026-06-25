"use client";

type ChartTooltipPayload = {
  color?: string;
  name?: string | number;
  dataKey?: string | number;
  value?: unknown;
  payload?: Record<string, unknown>;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: unknown;
  labelFormatter?: (label: unknown) => string;
  valueFormatter?: (value: unknown, name?: unknown, payload?: ChartTooltipPayload) => string;
  nameFormatter?: (name: unknown, payload?: ChartTooltipPayload) => string;
  hideLabel?: boolean;
};

function defaultValueFormatter(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isNaN(numeric)) {
    return numeric.toLocaleString(undefined, {
      minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  return String(value ?? "");
}

function defaultNameFormatter(name: unknown) {
  const raw = String(name ?? "Value");
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  nameFormatter,
  hideLabel = false,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const visiblePayload = payload.filter((entry) => entry.value !== undefined && entry.value !== null);

  if (visiblePayload.length === 0) return null;

  return (
    <div className="gl-chart-tooltip">
      {!hideLabel && label !== undefined && label !== null ? (
        <div className="gl-chart-tooltip__label">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {visiblePayload.map((entry, index) => {
          const name = nameFormatter
            ? nameFormatter(entry.name ?? entry.dataKey, entry)
            : defaultNameFormatter(entry.name ?? entry.dataKey);

          const value = valueFormatter
            ? valueFormatter(entry.value, entry.name ?? entry.dataKey, entry)
            : defaultValueFormatter(entry.value);

          return (
            <div
              key={`${String(entry.dataKey ?? entry.name ?? "value")}-${index}`}
              className="gl-chart-tooltip__row"
            >
              <span className="gl-chart-tooltip__name">
                <span
                  className="gl-chart-tooltip__dot"
                  style={{ backgroundColor: entry.color ?? "rgba(255,255,255,0.82)" }}
                />
                {name}
              </span>

              <span className="gl-chart-tooltip__value">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
