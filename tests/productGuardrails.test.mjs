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
const browserClient = await read("../lib/supabase/client.ts");
const ciWorkflow = await read("../.github/workflows/ci.yml");
const playwrightConfig = await read("../playwright.config.ts");
const appLayout = await read("../app/(app)/layout.tsx");
const analyticsLayout = await read("../app/(app)/admin/analytics/layout.tsx");
const analyticsPage = await read("../app/(app)/admin/analytics/page.tsx");
const dashboardPage = await read("../app/(app)/dashboard/page.tsx");
const recurringInsights = await read("../components/recurring/RecurringInsights.tsx");
const walletsPage = await read("../app/(app)/wallets/page.tsx");
const transactionsPage = await read("../app/(app)/transactions/page.tsx");
const familyPagePolished = await read("../app/(app)/settings/family/page.tsx");
const securityPage = await read("../app/(app)/settings/security/page.tsx");
const analyticsLoading = await read("../app/(app)/admin/analytics/loading.tsx");
const transactionsLoading = await read("../app/(app)/transactions/loading.tsx");
const workspaceConfig = await read("../pnpm-workspace.yaml");
const lockfile = await read("../pnpm-lock.yaml");
const financialHealth = await read("../components/dashboard/FinancialHealthScore.tsx");
const sameOrigin = await read("../lib/http/sameOrigin.ts");
const familyInvitations = await read("../app/api/family/invitations/route.ts");

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

test("public auth pages can prerender without CI-only Supabase variables", () => {
  assert.match(browserClient, /typeof window === "undefined"/);
  assert.match(browserClient, /build-time-placeholder/);
  assert.match(browserClient, /throw new Error\("Missing NEXT_PUBLIC_SUPABASE_URL/);
});

test("CI browser checks use inert public configuration and Chromium on mobile", () => {
  assert.match(ciWorkflow, /NEXT_PUBLIC_SUPABASE_URL: http:\/\/127\.0\.0\.1:54321/);
  assert.match(ciWorkflow, /NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-public-anon-key/);
  assert.match(playwrightConfig, /devices\["iPhone 13"\], browserName: "chromium"/);
});

test("platform analytics navigation and page access share the server-side admin policy", () => {
  assert.match(appLayout, /isPlatformAdmin\(user\?\.email\)/);
  assert.match(appLayout, /showPlatformAnalytics=/);
  assert.match(analyticsLayout, /isPlatformAdmin\(user\?\.email\)/);
  assert.match(analyticsLayout, /redirect\("\/dashboard"\)/);
});

test("usage metrics describe rolling windows accurately", () => {
  assert.match(analyticsPage, /label="30-day active"/);
  assert.match(analyticsPage, /in 24 hours/);
  assert.doesNotMatch(analyticsPage, /active_users_24h\)} today/);
});

test("dashboard category metrics and filters respect soft deletion", () => {
  assert.match(dashboardPage, /category\.is_active && category\.type === "expense"/);
  assert.match(dashboardPage, /category\.is_active \|\| referencedCategoryIds\.has\(category\.id\)/);
  assert.match(dashboardPage, /analyticsCategories\.map/);
});

test("recurring upcoming net preserves its financial sign", () => {
  assert.match(recurringInsights, /value: formatAmount\(upcomingNetMinor, currencyCode\)/);
  assert.doesNotMatch(recurringInsights, /Math\.abs\(upcomingNetMinor\)/);
});

test("the production dependency graph pins the patched Browserslist release", () => {
  assert.match(workspaceConfig, /browserslist: 4\.28\.7/);
  assert.match(lockfile, /browserslist@4\.28\.7/);
  assert.doesNotMatch(lockfile, /browserslist@4\.28\.[0-6]/);
});

test("every private data surface has a deliberate loading and retry path", () => {
  assert.match(transactionsPage, /TransactionsLoadingSkeleton/);
  assert.match(transactionsLoading, /TransactionsLoadingSkeleton/);
  assert.match(analyticsLoading, /AnalyticsLoadingSkeleton/);
  assert.match(walletsPage, /Wallet balances are temporarily unavailable/);
  assert.match(familyPagePolished, /Household access is temporarily unavailable/);
  assert.match(securityPage, /Security status is temporarily unavailable/);
});

test("financial health values are responsive without ellipsis", () => {
  assert.match(financialHealth, /financial-health-grid/);
  assert.match(financialHealth, /break-words text-sm font-semibold tabular-nums/);
  assert.doesNotMatch(financialHealth, /truncate text-xs font-semibold tabular-nums/);
});

test("cookie-authenticated family mutations verify their request origin", () => {
  assert.match(sameOrigin, /sec-fetch-site/);
  assert.match(sameOrigin, /request\.nextUrl\.origin/);
  assert.match(familyInvitations, /hasTrustedMutationOrigin/);
});
