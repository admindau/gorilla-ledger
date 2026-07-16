export type OccurredAtPrecision = "date" | "datetime";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function currentLocalDate(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentLocalTime(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function currentLocalMonthBoundsIso(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function calendarMonthKey(value: string | Date, timeZone = browserTimeZone()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : null;
}

export function buildOccurredAt(params: {
  date: string;
  time?: string;
  precision: OccurredAtPrecision;
}): string | null {
  const { date, time = "", precision } = params;
  if (!DATE_PATTERN.test(date)) return null;

  if (precision === "date") {
    // Noon UTC keeps a date-only value on the intended calendar day worldwide.
    return `${date}T12:00:00.000Z`;
  }

  if (!TIME_PATTERN.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day ||
    localDate.getHours() !== hour ||
    localDate.getMinutes() !== minute
  ) {
    return null;
  }
  return localDate.toISOString();
}

export function occurredAtFormValues(
  occurredAt: string,
  precision: OccurredAtPrecision = "date",
  timeZone?: string | null
) {
  if (precision === "date") {
    return { date: occurredAt.slice(0, 10), time: "" };
  }

  const value = new Date(occurredAt);
  if (Number.isNaN(value.getTime())) {
    return { date: occurredAt.slice(0, 10), time: "" };
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || browserTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function occurredAtDateKey(
  occurredAt: string,
  precision: OccurredAtPrecision = "date",
  timeZone?: string | null
) {
  return occurredAtFormValues(occurredAt, precision, timeZone).date;
}

export function formatOccurredAt(
  occurredAt: string,
  precision: OccurredAtPrecision = "date",
  timeZone?: string | null
): { date: string; time: string | null } {
  if (precision === "date") {
    const [year, month, day] = occurredAt.slice(0, 10).split("-").map(Number);
    const safeDate = new Date(year, (month || 1) - 1, day || 1);
    return {
      date: Number.isNaN(safeDate.getTime())
        ? occurredAt.slice(0, 10)
        : new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(safeDate),
      time: null,
    };
  }

  const value = new Date(occurredAt);
  if (Number.isNaN(value.getTime())) return { date: occurredAt.slice(0, 10), time: null };
  const options = { timeZone: timeZone || browserTimeZone() };
  return {
    date: new Intl.DateTimeFormat("en", {
      ...options,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(value),
    time: new Intl.DateTimeFormat("en", {
      ...options,
      hour: "numeric",
      minute: "2-digit",
    }).format(value),
  };
}

export function compareLedgerTransactions(
  a: { id: string; occurred_at: string },
  b: { id: string; occurred_at: string }
) {
  const occurredComparison = b.occurred_at.localeCompare(a.occurred_at);
  return occurredComparison || b.id.localeCompare(a.id);
}
