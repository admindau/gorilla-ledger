/**
 * Shared transaction classification helpers.
 *
 * Classification prefers explicit semantic fields when they exist, while
 * preserving compatibility with the current category-name based data model.
 * The name fallback is intentionally based on a small normalized alias set,
 * avoiding broad prefix matching that could misclassify unrelated categories.
 */

export type ClassifiableCategory = {
  name?: string | null;
  slug?: string | null;
  system_key?: string | null;
  is_internal_transfer?: boolean | null;
};

export type ClassifiableTransaction = {
  type?: string | null;
  transaction_kind?: string | null;
  is_internal_transfer?: boolean | null;
  transfer_id?: string | null;
};

const INTERNAL_TRANSFER_KEYS = new Set([
  "transfer",
  "internal_transfer",
  "wallet_transfer",
  "account_transfer",
]);

const INTERNAL_TRANSFER_NAMES = new Set([
  "transfer",
  "transfers",
  "internal transfer",
  "internal transfers",
  "wallet transfer",
  "wallet transfers",
  "account transfer",
  "account transfers",
]);

function normalizeKey(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function normalizeName(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isInternalTransfer(
  transaction?: ClassifiableTransaction | null,
  category?: ClassifiableCategory | null
): boolean {
  if (transaction?.is_internal_transfer === true) return true;
  if (category?.is_internal_transfer === true) return true;
  if (Boolean(transaction?.transfer_id)) return true;

  const transactionType = normalizeKey(transaction?.type);
  const transactionKind = normalizeKey(transaction?.transaction_kind);
  const categorySystemKey = normalizeKey(category?.system_key);
  const categorySlug = normalizeKey(category?.slug);

  if (INTERNAL_TRANSFER_KEYS.has(transactionType)) return true;
  if (INTERNAL_TRANSFER_KEYS.has(transactionKind)) return true;
  if (INTERNAL_TRANSFER_KEYS.has(categorySystemKey)) return true;
  if (INTERNAL_TRANSFER_KEYS.has(categorySlug)) return true;

  return INTERNAL_TRANSFER_NAMES.has(normalizeName(category?.name));
}
