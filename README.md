# Gorilla Ledger™

Gorilla Ledger is a passwordless, multi-currency personal and household ledger. It keeps currencies isolated, models transfers as paired balance movements, supports budgets and recurring entries, and provides browser-generated portable exports.

## Architecture

- Next.js 16 App Router and React 19 provide public, authentication, and protected application surfaces.
- Supabase Auth provides email OTP and TOTP MFA. PostgreSQL, RLS, RPCs, and Storage protect ledger and receipt data.
- Resend delivers one-time-code and household invitation email.
- Vercel hosts the application, runs the recurring cron, and receives Speed Insights.
- A privacy-conscious activity rollup powers the private platform analytics view for `admindau@proton.me` (or addresses configured in `PLATFORM_ADMIN_EMAILS`).
- Household data retains a canonical ledger owner while `created_by` and `updated_by` preserve the acting member.

Financial amounts are authoritative integer minor units. Currencies are never combined unless a future, explicit FX layer supplies a rate and provenance. Operational transactions exclude paired transfer/FX legs from income, expense, and budget totals.

## Prerequisites and setup

Use Node.js 22 and pnpm 11.8.0. Create a local Supabase project or an isolated development project; never point tests at a personal production ledger.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Required environment variable names:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `RESEND_API_KEY` (server only)
- `CRON_SECRET` (server only)
- `AUTH_RATE_LIMIT_PEPPER` (server only, recommended and distinct from other keys)
- `PLATFORM_ADMIN_EMAILS` (server only, optional comma-separated override for platform analytics access)

Never expose server-only values through a `NEXT_PUBLIC_` name, logs, screenshots, fixtures, or client bundles.

## Database and security model

Apply `supabase/migrations` in timestamp order before deploying application code that depends on them. RLS grants household members reads and grants only owners/editors writes. Viewers are read-only. Service-role use is limited to server routes and recurring work. Authentication throttling stores keyed digests, not raw email or IP values. Receipt limits are enforced at the Storage bucket and signing route.

Protected responses use private `no-store` caching. The application enforces CSP, frame denial, HSTS, a restrictive permissions policy, and source-map suppression in production. See [SECURITY.md](./SECURITY.md) for reporting and required repository settings.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit:prod
pnpm certify
```

Tests cover finance, currency isolation, transaction time semantics, transfers, recurring schedules, exports, authentication navigation, and household boundaries. Pull requests run CI, dependency review, and CodeQL.

`pnpm test:e2e` runs desktop and mobile Playwright/axe checks for public and authentication routes. Set `E2E_AUTH_STORAGE` to a Playwright storage-state file for a dedicated, non-personal test account to enable the protected-route suite; never commit that file.

## Deployment

1. Review and back up the target Supabase project.
2. Apply pending migrations and run advisor checks.
3. Deploy a Vercel preview and complete login, MFA, ledger mutation, receipt, export, and household smoke checks.
4. Merge only with required GitHub checks green; verify production headers and the recurring-cron response.
5. Monitor route errors, Web Vitals, auth delivery latency, cron failures, and backup age.

The recurring endpoint is `/api/cron/recurring`, authenticated with `CRON_SECRET`, and scheduled hourly. `(recurring_rule_id, scheduled_for)` uniqueness makes overlapping execution idempotent; failures remain due for a later retry and are visible in the run audit.

## Operations

Recovery, rotation, incident, SLO, and release procedures are in [docs/OPERATIONS-RUNBOOK.md](./docs/OPERATIONS-RUNBOOK.md). The product audit and implementation rationale are in [docs/PRODUCT-LEAD-AUDIT-2026-09-01.md](./docs/PRODUCT-LEAD-AUDIT-2026-09-01.md).

## Troubleshooting

- Auth unavailable: verify Supabase URL/anon key, Auth health, redirect allow-list, email provider, and auth-rate-limit migration.
- Receipt rejected: confirm MIME type, extension, actual size under 5 MB, Storage bucket configuration, and ledger role.
- Recurring duplicate: inspect the unique scheduled-run constraint and run logs before changing data.
- Missing household data: verify active ledger membership and RLS policies; do not bypass them from the browser.
- Build CSP failure: inspect the browser violation and add the narrowest required origin. Do not broadly add `*`.
