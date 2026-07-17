import assert from "node:assert/strict";
import test from "node:test";

import {
  factorDisplayName,
  initialFactorSelection,
  verifiedTotpFactors,
} from "../lib/auth/mfa.ts";

const primary = {
  id: "primary-id",
  status: "verified",
  friendly_name: "iPhone",
};
const backup = {
  id: "backup-id",
  status: "verified",
  friendly_name: "1Password",
};

test("only verified TOTP factors are offered at sign-in", () => {
  const factors = verifiedTotpFactors([
    primary,
    { id: "unfinished-id", status: "unverified", friendly_name: "Old setup" },
    backup,
  ]);

  assert.deepEqual(factors, [primary, backup]);
});

test("a single authenticator is selected automatically", () => {
  assert.equal(initialFactorSelection([primary]), primary.id);
});

test("multiple authenticators require an explicit user selection", () => {
  assert.equal(initialFactorSelection([primary, backup]), null);
});

test("factor labels prefer friendly names and provide a safe fallback", () => {
  assert.equal(factorDisplayName(primary, 0), "iPhone");
  assert.equal(
    factorDisplayName({ id: "unnamed", status: "verified" }, 1),
    "Authenticator 2",
  );
});
