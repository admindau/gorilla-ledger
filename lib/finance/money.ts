export type MoneyParseResult =
  | { ok: true; minor: number }
  | { ok: false; error: string };

/**
 * Parse a user-entered decimal amount without floating-point rounding.
 * Ledger amounts are positive and support at most two decimal places.
 */
export function parseMoneyToMinor(value: string): MoneyParseResult {
  const normalized = value.trim().replace(/,/g, "");

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, error: "Enter a valid amount with no more than two decimal places." };
  }

  const [whole, fraction = ""] = normalized.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const minor = Number(whole) * 100 + sign * Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(minor)) {
    return { ok: false, error: "Enter an amount within the supported range." };
  }

  return { ok: true, minor };
}

export function parsePositiveMoneyToMinor(value: string): MoneyParseResult {
  const parsed = parseMoneyToMinor(value);
  if (!parsed.ok) return parsed;
  if (parsed.minor <= 0) return { ok: false, error: "Enter an amount greater than zero." };
  return parsed;
}

export function isValidLedgerDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function ledgerMonthParts(iso: string): { year: number; month0: number } | null {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month0 = Number(match[2]) - 1;
  if (!Number.isInteger(year) || month0 < 0 || month0 > 11) return null;
  return { year, month0 };
}
