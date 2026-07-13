export function formatCompactAxisValue(value: number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";

  const absolute = Math.abs(numeric);
  if (absolute >= 1_000_000_000) {
    return `${trimDecimal(numeric / 1_000_000_000)}B`;
  }
  if (absolute >= 1_000_000) {
    return `${trimDecimal(numeric / 1_000_000)}M`;
  }
  if (absolute >= 1_000) {
    return `${trimDecimal(numeric / 1_000)}K`;
  }

  return numeric.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function trimDecimal(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  });
}

export function formatDailyAxisLabel(raw: string): string {
  const date = parseLedgerDate(raw);
  if (!date) return raw;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function formatDailyTooltipLabel(raw: string): string {
  const date = parseLedgerDate(raw);
  if (!date) return raw;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMonthlyAxisLabel(raw: string): string {
  const date = parseLedgerDate(raw);
  if (!date) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

export function formatMonthlyTooltipLabel(raw: string): string {
  const date = parseLedgerDate(raw);
  if (!date) return raw;

  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function getAdaptiveTickGap(pointCount: number): number {
  if (pointCount <= 10) return 16;
  if (pointCount <= 35) return 24;
  if (pointCount <= 120) return 34;
  return 44;
}

export function parseLedgerDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.split("-").map(Number);

  if (parts.length >= 2 && parts.every(Number.isFinite)) {
    const [year, month, day = 1] = parts;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}
