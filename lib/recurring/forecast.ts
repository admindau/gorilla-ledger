export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type ForecastRecurringRule = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount_minor: number;
  currency_code: string;
  frequency: RecurringFrequency;
  interval: number | null;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string | null;
  end_date: string | null;
  next_run_at: string | null;
  is_active: boolean;
};

export type RecurringForecastEntry = {
  currencyCode: string;
  scheduledIncomeMinor: number;
  scheduledExpenseMinor: number;
  scheduledOccurrencesCount: number;
  scheduledRuleIds: string[];
};

const DEFAULT_MAX_OCCURRENCES_PER_RULE = 400;

function positiveStep(interval: number | null | undefined): number {
  return interval && Number.isFinite(interval) && interval > 0
    ? Math.floor(interval)
    : 1;
}

function utcDaysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Advance one recurring occurrence while preserving its UTC time-of-day.
 * Monthly and yearly schedules clamp their configured day to the final valid
 * day of the target month (for example, 31 January -> 28/29 February).
 */
export function advanceRecurringDate(
  current: Date,
  frequency: RecurringFrequency,
  interval: number | null,
  dayOfMonth?: number | null
): Date {
  const step = positiveStep(interval);
  const next = new Date(current.getTime());

  if (frequency === "daily") {
    next.setUTCDate(next.getUTCDate() + step);
    return next;
  }

  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + step * 7);
    return next;
  }

  const hour = next.getUTCHours();
  const minute = next.getUTCMinutes();
  const second = next.getUTCSeconds();
  const millisecond = next.getUTCMilliseconds();
  const configuredDay = Math.max(
    1,
    Math.min(31, dayOfMonth ?? next.getUTCDate())
  );

  if (frequency === "monthly") {
    const targetMonthIndex = next.getUTCMonth() + step;
    const targetYear = next.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const targetDay = Math.min(
      configuredDay,
      utcDaysInMonth(targetYear, targetMonth)
    );

    return new Date(
      Date.UTC(
        targetYear,
        targetMonth,
        targetDay,
        hour,
        minute,
        second,
        millisecond
      )
    );
  }

  const targetYear = next.getUTCFullYear() + step;
  const targetMonth = next.getUTCMonth();
  const targetDay = Math.min(
    configuredDay,
    utcDaysInMonth(targetYear, targetMonth)
  );

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      hour,
      minute,
      second,
      millisecond
    )
  );
}

export function listRecurringOccurrences(
  rule: ForecastRecurringRule,
  windowStart: Date,
  windowEnd: Date,
  maxOccurrences = DEFAULT_MAX_OCCURRENCES_PER_RULE
): Date[] {
  if (!rule.is_active || windowEnd.getTime() < windowStart.getTime()) return [];

  let occurrence = validDate(rule.next_run_at);
  if (!occurrence) return [];

  const startBoundary = validDate(rule.start_date)?.getTime() ?? null;
  const endBoundary = validDate(rule.end_date)?.getTime() ?? null;
  const occurrences: Date[] = [];
  let advances = 0;

  // Advance overdue schedules to the first occurrence inside the requested
  // window. The guard prevents malformed rules from creating an unsafe loop.
  while (occurrence.getTime() < windowStart.getTime()) {
    occurrence = advanceRecurringDate(
      occurrence,
      rule.frequency,
      rule.interval,
      rule.day_of_month
    );
    advances += 1;
    if (advances > maxOccurrences * 5) return [];
  }

  while (
    occurrence.getTime() <= windowEnd.getTime() &&
    occurrences.length < maxOccurrences
  ) {
    const occurrenceTime = occurrence.getTime();
    const occurrenceKey = utcDateKey(occurrence);
    const isAfterRuleStart =
      startBoundary === null || occurrenceKey >= rule.start_date!;
    const isBeforeRuleEnd =
      endBoundary === null || occurrenceKey <= rule.end_date!;

    if (isAfterRuleStart && isBeforeRuleEnd) {
      occurrences.push(new Date(occurrenceTime));
    }

    if (!isBeforeRuleEnd) break;

    occurrence = advanceRecurringDate(
      occurrence,
      rule.frequency,
      rule.interval,
      rule.day_of_month
    );
  }

  return occurrences;
}

export function buildRecurringForecast(
  rules: ForecastRecurringRule[],
  windowStart: Date,
  windowEnd: Date
): {
  entries: RecurringForecastEntry[];
  totalOccurrences: number;
  activeRuleCount: number;
} {
  const byCurrency = new Map<
    string,
    {
      income: number;
      expense: number;
      occurrences: number;
      ruleIds: Set<string>;
    }
  >();
  let totalOccurrences = 0;
  const activeRuleIds = new Set<string>();

  for (const rule of rules) {
    if (!rule.is_active) continue;
    const occurrences = listRecurringOccurrences(rule, windowStart, windowEnd);
    if (occurrences.length === 0) continue;

    const current = byCurrency.get(rule.currency_code) ?? {
      income: 0,
      expense: 0,
      occurrences: 0,
      ruleIds: new Set<string>(),
    };
    const scheduledAmount = rule.amount_minor * occurrences.length;

    if (rule.type === "income") current.income += scheduledAmount;
    else current.expense += scheduledAmount;

    current.occurrences += occurrences.length;
    current.ruleIds.add(rule.id);
    byCurrency.set(rule.currency_code, current);
    totalOccurrences += occurrences.length;
    activeRuleIds.add(rule.id);
  }

  const entries = Array.from(byCurrency.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, value]) => ({
      currencyCode,
      scheduledIncomeMinor: value.income,
      scheduledExpenseMinor: value.expense,
      scheduledOccurrencesCount: value.occurrences,
      scheduledRuleIds: Array.from(value.ruleIds),
    }));

  return {
    entries,
    totalOccurrences,
    activeRuleCount: activeRuleIds.size,
  };
}
