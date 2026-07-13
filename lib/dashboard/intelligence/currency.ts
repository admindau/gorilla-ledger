import type {
  CurrencyCode,
  CurrencyInsight,
  CurrencyInsightMap,
} from "./types";

/** Normalize externally supplied currency codes at the intelligence boundary. */
export function normalizeCurrencyCode(value: string): CurrencyCode {
  return value.trim().toUpperCase();
}

/** Return unique normalized currency codes in deterministic display order. */
export function normalizeCurrencyCodes(values: Iterable<string>): CurrencyCode[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map(normalizeCurrencyCode)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function currencyInsightsToMap(
  entries: readonly CurrencyInsight[]
): CurrencyInsightMap {
  return Object.fromEntries(
    entries.map((entry) => [entry.currencyCode, entry])
  );
}

export function findCurrencyInsight(
  entries: readonly CurrencyInsight[],
  currencyCode: string
): CurrencyInsight | null {
  const normalized = normalizeCurrencyCode(currencyCode);
  return entries.find((entry) => entry.currencyCode === normalized) ?? null;
}
