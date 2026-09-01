# Gorilla Ledger operations runbook

## Service objectives

| Signal | Objective | Alert threshold | Owner |
| --- | --- | --- | --- |
| Public/login availability | 99.9% over 30 days | 2 failures in 5 minutes | Product engineering |
| Login-code accepted by provider | 99% over 24 hours | <97% for 15 minutes | Product engineering |
| Auth and private API latency | p95 <1.5 s | p95 >2.5 s for 15 minutes | Product engineering |
| Recurring execution | 99% of due runs within 2 hours | any failed run or oldest due >2 hours | Ledger operations |
| Web Vitals | LCP <2.5 s, INP <200 ms, CLS <0.10 at p75 | route/device p75 exceeds target for 3 days | Product engineering |
| Backup age | latest recoverable backup <24 hours | >24 hours | Data owner |

First-priority routes are dashboard, auth confirmation, MFA, recurring, and exports. Web Vital logs contain route and metric only; they must never contain email, descriptions, amounts, tokens, receipt data, or signed URLs.

## Release and rollback

Before release, confirm migrations are backward-compatible, take or verify a Supabase backup, run `pnpm certify` and the production smoke checklist, and record the current Vercel deployment and migration timestamp. Apply migrations before code when new RPCs or columns are required.

To roll back application code, promote the last known-good Vercel deployment. Do not reverse a data migration destructively. Use a tested forward migration to restore compatibility. If a release could have written incorrect financial data, disable the affected mutation or cron first, retain audit evidence, and reconcile before re-enabling it.

## Supabase restore drill

Quarterly, restore the latest backup into a new, non-production project. Apply any migrations newer than the backup, configure isolated test-only Auth and Storage, and verify row counts, RLS, wallet reconciliation, paired transfers, recurring uniqueness, and receipt metadata/object access. Record recovery-point and recovery-time results. Never attach the restored project to production Vercel or email delivery.

## Secret rotation

- `CRON_SECRET`: create a new random value, update Vercel, redeploy, verify one authorized and one unauthorized request, then invalidate the old value.
- Supabase service role: follow Supabase key-rotation procedure, update Vercel, redeploy, test server-only routes, and inspect logs for authorization failures.
- Resend: create a replacement key, update Vercel, send to an operator-owned test address, then revoke the prior key.
- `AUTH_RATE_LIMIT_PEPPER`: rotation makes existing limiter buckets unreachable; rotate during a quiet window and accept that limits reset. Never reuse the service-role value long term.

Record who rotated each secret and when, but never record the secret value.

## Incident response

1. Classify scope: authentication, confidentiality, financial integrity, availability, recurring automation, or third-party outage.
2. Preserve privacy-redacted request IDs, deployment IDs, timestamps, and audit events. Do not copy OTPs, tokens, signed URLs, descriptions, full emails, or receipt contents.
3. Contain: pause cron, disable a route, revoke a key, or promote a known-good deployment as appropriate.
4. Reconcile data by currency and ledger. Do not silently repair paired transfers or recurring transactions.
5. Communicate verified impact and recovery steps without unqualified security claims.
6. Complete a blameless review with detection, timeline, root cause, corrective actions, and owners.

Security reports follow `SECURITY.md`. Enable GitHub private vulnerability reporting, Dependabot alerts and updates, secret-scanning push protection, CodeQL, and required branch checks manually.

## Production checks

Synthetic monitoring must use a dedicated, non-personal test ledger and must not email a real customer. Check `/`, `/auth/login`, authenticated dashboard availability, a read-only Supabase query, and cron health. The Vercel billing profile and Supabase API/Auth warnings are operational prerequisites and must be reviewed by an account owner during every monthly service review.
