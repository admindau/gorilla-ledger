import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmailConfirmationUrl,
  isEmailOtpType,
} from "../lib/auth/confirmation.ts";

test("email confirmation tokens stay in the fragment and out of preview requests", () => {
  const result = new URL(
    buildEmailConfirmationUrl({
      siteUrl: "https://gl.example.com",
      next: "/dashboard?month=2026-08",
      tokenHash: "sensitive-token",
      type: "signup",
    })
  );

  assert.equal(result.origin, "https://gl.example.com");
  assert.equal(result.pathname, "/auth/confirm");
  assert.equal(result.searchParams.get("next"), "/dashboard?month=2026-08");
  assert.equal(result.searchParams.has("token_hash"), false);
  assert.equal(new URLSearchParams(result.hash.slice(1)).get("token_hash"), "sensitive-token");
  assert.equal(new URLSearchParams(result.hash.slice(1)).get("type"), "signup");
});

test("only supported email verification types reach Supabase", () => {
  for (const type of ["signup", "invite", "magiclink", "recovery", "email_change", "email"]) {
    assert.equal(isEmailOtpType(type), true);
  }
  assert.equal(isEmailOtpType("sms"), false);
  assert.equal(isEmailOtpType(null), false);
});
