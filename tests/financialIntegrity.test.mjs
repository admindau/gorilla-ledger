import test from "node:test";
import assert from "node:assert/strict";

import {
  isInternalTransfer,
  isInternalTransferCategory,
  isOperationalTransaction,
} from "../lib/transactions/classification.ts";
import {
  isValidLedgerDate,
  ledgerMonthParts,
  parseMoneyToMinor,
  parsePositiveMoneyToMinor,
} from "../lib/finance/money.ts";
import { isMissingLedgerMetadata } from "../lib/supabase/schemaCompatibility.ts";

test("FX categories are balance movements, not operating income or expense", () => {
  for (const name of ["FX", "Foreign Exchange", "Currency conversion"]) {
    assert.equal(isInternalTransfer({ type: "income" }, { name }), true);
    assert.equal(isOperationalTransaction({ type: "expense" }, { name }), false);
  }
});

test("explicit ledger semantics survive category renames", () => {
  assert.equal(
    isInternalTransfer({ transaction_kind: "fx" }, { name: "Renamed category" }),
    true
  );
  assert.equal(
    isInternalTransfer({ transfer_id: "pair-id" }, { name: "Anything" }),
    true
  );
});

test("internal categories stay identifiable before a transaction exists", () => {
  for (const category of [
    { name: "Transfer In" },
    { name: "Transfer Out" },
    { name: "FX" },
    { slug: "currency-exchange" },
    { system_key: "wallet_transfer" },
  ]) {
    assert.equal(isInternalTransferCategory(category), true);
  }
  assert.equal(isInternalTransferCategory({ name: "Salary" }), false);
});

test("strict money parsing accepts grouping and rejects silent truncation", () => {
  assert.deepEqual(parsePositiveMoneyToMinor("4,453,297.08"), {
    ok: true,
    minor: 445329708,
  });
  assert.equal(parsePositiveMoneyToMinor("100.999").ok, false);
  assert.equal(parsePositiveMoneyToMinor("not money").ok, false);
  assert.equal(parsePositiveMoneyToMinor("0").ok, false);
  assert.deepEqual(parseMoneyToMinor("-12.40"), { ok: true, minor: -1240 });
});

test("ledger dates use their stored calendar date independent of local timezone", () => {
  assert.equal(isValidLedgerDate("2026-02-29"), false);
  assert.equal(isValidLedgerDate("2028-02-29"), true);
  assert.deepEqual(ledgerMonthParts("2026-07-01T00:00:00.000Z"), {
    year: 2026,
    month0: 6,
  });
});

test("schema compatibility only falls back for known ledger metadata drift", () => {
  assert.equal(
    isMissingLedgerMetadata({ code: "42703", message: "column transactions.transaction_kind does not exist" }),
    true
  );
  assert.equal(
    isMissingLedgerMetadata({ code: "42501", message: "permission denied for table transactions" }),
    false
  );
});
