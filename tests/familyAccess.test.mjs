import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260821120000_household_collaboration.sql", import.meta.url), "utf8");
const invitationRoute = await readFile(new URL("../app/api/family/invitations/route.ts", import.meta.url), "utf8");
const receiptAccess = await readFile(new URL("../lib/family/access.ts", import.meta.url), "utf8");
const familyPage = await readFile(new URL("../app/(app)/settings/family/page.tsx", import.meta.url), "utf8");
const registerPage = await readFile(new URL("../app/auth/register/page.tsx", import.meta.url), "utf8");
const invitePage = await readFile(new URL("../app/invite/page.tsx", import.meta.url), "utf8");

test("household data access is membership-backed", () => {
  assert.match(migration, /create table if not exists public\.ledger_members/);
  assert.match(migration, /public\.current_ledger_owner_id\(\)/);
  assert.match(migration, /create policy household_select/);
  assert.match(migration, /created_by/);
  assert.match(migration, /updated_by/);
});

test("family invitations are hashed, expiring, and email-bound", () => {
  assert.match(migration, /extensions\.digest\(v_token, 'sha256'\)/);
  assert.match(migration, /extensions\.gen_random_bytes\(32\)/);
  assert.match(migration, /interval '7 days'/);
  assert.match(migration, /v_email <> v_invitation\.email/);
  assert.match(migration, /interval '30 seconds'/);
  assert.match(migration, /Invitation limit reached/);
  assert.match(invitationRoute, /revoke_ledger_invitation/);
});

test("receipt APIs can authorize a ledger member without sharing accounts", () => {
  assert.match(receiptAccess, /ledger_members/);
  assert.match(receiptAccess, /user_id/);
  assert.match(receiptAccess, /owner_user_id/);
});

test("invitation failures recover to a usable family page", () => {
  assert.match(familyPage, /setError\(apiError\(body/);
  assert.match(familyPage, /await loadOverview\(\)/);
  assert.match(familyPage, /window\.history\.replaceState\(null, "", "\/settings\/family"\)/);
});

test("invitees receive contextual signup and invalid-link recovery", () => {
  assert.match(registerPage, /familyInvite/);
  assert.match(invitePage, /Ask the ledger owner to send you a new invitation/);
  assert.match(invitePage, /Return to Gorilla Ledger/);
});
