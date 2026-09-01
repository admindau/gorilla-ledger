import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const authRoute = await read("../app/auth/send-magic-link/route.ts");
const authMigration = await read("../supabase/migrations/20260901180000_auth_delivery_guardrails.sql");
const receiptRoute = await read("../app/api/receipts/sign-upload/route.ts");
const receiptMigration = await read("../supabase/migrations/20260901183000_receipt_storage_limits.sql");
const mfaPanel = await read("../components/security/SecurityMfaPanel.tsx");
const categoriesPage = await read("../app/(app)/categories/page.tsx");
const familyPage = await read("../app/(app)/settings/family/page.tsx");
const emailDelivery = await read("../lib/email.ts");
const adminClient = await read("../lib/supabase/admin.ts");

test("passwordless throttling is distributed and account lookup does not enumerate users", () => {
  assert.match(authRoute, /consume_auth_rate_limit/);
  assert.match(authRoute, /auth_user_exists/);
  assert.match(authRoute, /createHmac/);
  assert.doesNotMatch(authRoute, /new Map|listUsers/);
  assert.match(authMigration, /security definer/);
  assert.match(authMigration, /grant execute.*service_role/);
});

test("receipt limits are enforced by both signing policy and storage", () => {
  assert.match(receiptRoute, /MAX_RECEIPT_BYTES = 5 \* 1024 \* 1024/);
  assert.match(receiptRoute, /RECEIPT_EXTENSIONS/);
  assert.match(receiptMigration, /file_size_limit = 5242880/);
  assert.match(receiptMigration, /allowed_mime_types/);
});

test("MFA QR markup is isolated instead of injected into the application DOM", () => {
  assert.doesNotMatch(mfaPanel, /dangerouslySetInnerHTML/);
  assert.match(mfaPanel, /data:image\/svg\+xml/);
});

test("private collection and household routes use resolved loading skeletons", () => {
  assert.match(categoriesPage, /if \(loading\) return <CategoriesLoadingSkeleton/);
  assert.match(familyPage, /if \(loading\) return <FamilyLoadingSkeleton/);
  assert.doesNotMatch(familyPage, /Loading household access/);
});

test("email delivery can be imported during builds without a runtime API key", () => {
  assert.match(emailDelivery, /if \(!apiKey\)/);
  assert.ok(
    emailDelivery.indexOf("new Resend(apiKey)") > emailDelivery.indexOf("export async function sendEmail"),
    "Resend must be initialized lazily inside sendEmail"
  );
});

test("the Supabase service-role client is initialized only at request time", () => {
  assert.match(adminClient, /export function getSupabaseAdminClient/);
  assert.match(adminClient, /function createAdminClient/);
  assert.ok(
    adminClient.indexOf("adminClient ??= createAdminClient") >
      adminClient.indexOf("export function getSupabaseAdminClient"),
    "the admin client must not require deployment secrets during module evaluation"
  );
});
