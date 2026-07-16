const LEDGER_METADATA_COLUMNS = [
  "transaction_kind",
  "transfer_id",
  "recurring_rule_id",
  "scheduled_for",
  "occurred_at_precision",
  "occurred_timezone",
];

export function isMissingLedgerMetadata(error: { message?: string | null; code?: string | null } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    (error.code === "42703" || error.code === "PGRST204" || message.includes("does not exist")) &&
    LEDGER_METADATA_COLUMNS.some((column) => message.includes(column))
  );
}
