# Gorilla Ledger™ Product Lead Audit

Date: 1 September 2026
Production: `https://gl.savvyrilla.tech`
Audit mode: read-only product, browser, repository, Vercel, GitHub, and Supabase review

## Executive verdict

Gorilla Ledger is already a credible multi-currency finance product with unusually strong ledger-integrity thinking, a distinctive dark visual system, good semantic HTML, passwordless authentication, MFA, family collaboration, private browser-generated exports, and useful recurring-payment support.

The product is not primarily blocked by missing features. It is blocked by trust-eroding presentation and delivery details:

1. Production field data shows a Real Experience Score of 77 on desktop and CLS of 0.38. The dashboard, auth confirmation, MFA, and exports routes are the weakest measured experiences.
2. Route skeletons are followed by a second client-side loading phase. Several screens briefly show blank content, false zero counts, disabled security actions, or incomplete financial indicators before data resolves.
3. The dashboard repeats the same financial warning across too many panels. This conflicts with the public promise of “quiet intelligence” and makes the product feel more analytical than decisive.
4. The application security model is thoughtful, but engineering operations need hardening: no GitHub Actions CI, no Dependabot alerts, no CodeQL setup, no security policy, no private vulnerability reporting, no CSP, and four current production dependency advisories.
5. The visual system feels premium, but the public identity is dominated by the parent-company artwork and the in-product experience relies too heavily on small, low-contrast, uppercase metadata.

Recommended release posture: address Prompts 1–3 before calling the product premium-ready; complete Prompts 4–7 for a polished v1.1; use Prompts 8–10 for differentiation and operating maturity.

## Evidence snapshot

- Full passwordless login worked for `admindau@proton.me`: email code → MFA step-up → dashboard.
- Both inspected accounts are ledger owners of separate households. The product currently exposes owner/editor household roles, not an application-wide admin role.
- Vercel Speed Insights, desktop, last seven days, 558 events:
  - Real Experience Score: 77, needs improvement
  - FCP: 1.78 s
  - LCP: 2.36 s
  - INP: 48 ms
  - CLS: 0.38
  - TTFB: 0.61 s
  - Route RES: dashboard 74, auth confirmation 60, MFA 69, recurring 88, exports 73; login, transactions, wallets, security, registration, categories, and landing page were 99–100 in the inspected sample.
- Direct uncached-style production checks returned roughly 0.39 s TTFB for `/` and 0.68 s for `/auth/login` from the audit environment.
- Supabase reported healthy infrastructure, 99.9% request success over the prior 24 hours, a recent backup, and no advisor findings. One API warning and one auth warning were visible.
- Repository certification status:
  - lint passed
  - 57/57 unit tests passed
  - production build passed
  - no browser-level end-to-end suite exists
  - no GitHub Actions workflow exists
- `pnpm audit --prod` reported three high-severity and one moderate transitive advisories through `postcss`/`nanoid`.
- The built client contains roughly 2.6 MB of JavaScript chunks before transfer compression; several individual chunks are 230–328 KB. There are 48 client modules and multiple very large page components, including transactions (~1,800 lines) and dashboard (~1,600 lines).
- Security headers include HSTS, X-Frame-Options, nosniff, Referrer-Policy, COOP, and a restrictive Permissions-Policy. A Content-Security-Policy is not present.

## Key findings by product area

### Usability and information architecture

- The core navigation is predictable and the mobile bottom navigation is a strong foundation.
- Desktop navigation and account metadata use very small, low-contrast text. The raw email and security status compete with primary navigation.
- The dashboard contains too many overlapping interpretations of the same facts: hero status, health cards, alerts, forecast, executive insights, smart insights, and AI Coach often repeat the same negative cash-flow message.
- “Critical,” “Warning,” “Watch,” and “Good” are sometimes shown together or used inconsistently. A score of 58 can appear as both Warning and Watch. Forecast confidence can say “Reliable” while the supporting copy asks the user to add more data to improve confidence.
- The product calls deterministic guidance “AI Coach” and “model-driven.” If no externally trained or generative model is used, this language risks undermining trust.
- Destructive actions are visually frequent in wallet, category, budget, and recurring lists. They should be secondary actions with explicit dependency impact, typed confirmation only where necessary, and undo when technically safe.

### Loading, skeletons, and speed

- Route-level skeletons are polished, but protected pages are prerendered as static shells and then fetch all private data client-side. This produces a second loading phase after navigation.
- Categories briefly showed “Showing 0 of 0” and empty groups before resolving to 21 categories.
- Budgets and recurring initially exposed only the application chrome to accessibility APIs before content appeared.
- Security briefly displayed an unresolved score, disabled MFA actions, and “Loading security settings…” before becoming actionable.
- Family uses a plain loading sentence rather than a shape-matched skeleton.
- Deferred analytics placeholders remain visible for long periods and are a likely contributor to the measured CLS of 0.38.
- Navigation links explicitly disable Next.js prefetching, increasing the cost of repeated in-app navigation.

### Financial workflows

- Multi-currency separation is excellent and is backed by unit tests.
- Transaction creation exposes every active category while the user separately chooses income or expense. The interface should prevent or clearly reconcile type/category mismatches, with database enforcement as the final guard.
- Paired transfers appear in transaction history as separate income/expense records even though the rest of the product describes them as balance movements. The history should label and visually pair them as transfers/FX.
- Duplicate wallet names are allowed and become difficult to distinguish. Currency is visible, but the system should encourage unique display names or add institution/account aliases.
- Recurring rules can be paused or deleted but not edited. Reliability is presented as 100% after only one successful run, and a technical transaction UUID appears in the user-facing run audit.
- Exports are well described and private, but there is no one-click complete archive, receipt manifest, or documented restore/import path.

### Security and privacy

- Passwordless email-code login, generic anti-enumeration responses, MFA step-up, private no-store policies, RLS, ledger membership checks, constant-time cron-secret comparison, expiring hashed invitations, and spreadsheet-formula neutralization are strong.
- The in-memory authentication rate limiter is not reliable across serverless instances or cold starts.
- Email-code delivery returns the same apparent success state even when downstream delivery fails. That is correct for enumeration resistance but needs internal delivery telemetry and a better recovery path.
- The sign-in screen presents request and code-entry flows simultaneously, which is flexible but cognitively heavy. Preserve manual code entry while making the primary state progressive.
- A security score of 60 labeled “Foundation established” while MFA and backup access are both absent is too reassuring. Use risk states tied to concrete controls rather than a gamified score.
- Gorilla Ledger does not issue recovery codes. Backup authenticator guidance is useful but should be paired with a clearly documented recovery policy.
- Receipt upload authorization is membership-aware, but the server-side signed-upload path should explicitly enforce allowed MIME types, extensions, object ownership, and a 5 MB limit independent of the client.
- No CSP is sent. The MFA QR path uses `dangerouslySetInnerHTML`; it should be sanitized or replaced with a trusted QR rendering path before a strict CSP rollout.
- GitHub security automation is incomplete: Dependabot alerts disabled, code scanning not configured, security policy absent, and private vulnerability reporting disabled.

### Branding and premium quality

- The monochrome, glass-like visual language is distinctive and coherent.
- The public landing page is elegant and responsive, but the parent-company Africa artwork visually dominates the Gorilla Ledger product identity. The “G” mark feels provisional.
- The landing page lacks product proof: no dashboard preview, annotated workflow, trust architecture summary, or concrete explanation of multi-currency differentiation.
- “Open ledger,” “Start your ledger,” and “Sign in” create three overlapping entry points. Their audience and state should be clearer.
- Small gray copy, uppercase tracking, and repeated pill treatments reduce readability and make many cards feel visually equivalent.
- Negative balances and critical states depend too much on text labels and subtle borders; a restrained semantic color system would improve scanability without losing the monochrome brand.

### Reliability and operating maturity

- Supabase is healthy and its advisors report no current security or performance issues.
- Vercel field metrics are available, but there are no enforced performance budgets or route-level regression gates.
- There is no CI workflow, browser-level smoke test, dependency review, CodeQL scan, synthetic production check, or documented rollback/restore drill.
- The repository README is still the default Create Next App document and does not explain architecture, local setup, environment variables, migrations, security assumptions, or release procedures.
- The Vercel team currently displays an action-required billing-address notice. This is an operational continuity risk outside the application code.

## Copy-ready implementation prompts

### Prompt 1 — Eliminate layout shift and false loading states

```text
Act as a senior product engineer and performance lead. In the Gorilla Ledger Next.js application, redesign protected-route loading so users never see false financial, household, or security state while private data is resolving.

Scope dashboard, wallets, categories, transactions, budgets, recurring, exports, family, and security. Preserve the existing dark premium design and all financial-integrity behavior.

Requirements:
- Establish one coherent loading lifecycle per route. Avoid a polished route skeleton followed by a second blank or misleading client-side loading phase.
- Never render “0”, “Disabled”, empty collections, health scores, or actionable controls until that value has actually resolved. Use `unknown/loading/ready/empty/error/stale` states explicitly.
- Replace plain loading copy with shape-matched, dimensionally stable skeletons. Reserve final content height for hero metrics, KPI grids, lists, and lazy charts.
- Keep headings and navigation stable while loading. Use `aria-busy`, concise `role=status` announcements, and ensure skeletons themselves are hidden from assistive technology.
- Review the dashboard’s IntersectionObserver-driven deferred charts and eliminate the measured layout movement. Loading and final chart containers must have identical dimensions at every breakpoint.
- Re-evaluate `prefetch={false}` on internal navigation and enable safe route prefetching where it improves repeat navigation without exposing private data.
- Add performance instrumentation that attributes CLS elements and route transitions in development and production.

Acceptance criteria:
- No screen briefly reports false zero/disabled/empty data.
- Categories do not show “0 of 0” before the collection resolves.
- Family and security use stable skeletons and do not expose prematurely disabled actions.
- Vercel field CLS trends below 0.10, with an interim lab target below 0.05 on dashboard, auth confirmation, MFA, and exports.
- Add automated tests for loading-to-ready, loading-to-empty, and loading-to-error states.
- Run lint, unit tests, build, and new browser tests and report results.
```

### Prompt 2 — Establish security and release engineering guardrails

```text
Act as the security engineering lead for Gorilla Ledger. Harden the repository and deployment pipeline without changing user data or weakening the existing Supabase RLS and household access model.

Requirements:
- Add GitHub Actions CI for every pull request and main-branch push using pnpm with a frozen lockfile. Enforce lint, unit tests, production build, dependency audit, and a minimal browser smoke suite.
- Add CodeQL for JavaScript/TypeScript, dependency review for pull requests, Dependabot configuration, and secret-scanning-friendly patterns.
- Add SECURITY.md with a private reporting path, supported versions, response expectations, and disclosure policy. Document the GitHub settings the owner must enable manually: Dependabot alerts, code scanning, private vulnerability reporting, and branch protection.
- Resolve or safely override the current production advisories involving transitive `postcss` and `nanoid`. Demonstrate the resolved dependency tree and do not use a blanket audit ignore.
- Add a carefully tested Content-Security-Policy. Prefer nonces/hashes over `unsafe-inline`; include `frame-ancestors 'none'`; preserve Supabase, Vercel Speed Insights, receipt rendering, and authentication.
- Remove or sanitize the MFA QR `dangerouslySetInnerHTML` path before enforcing CSP.
- Add explicit cache, content-type, and security headers to JSON API responses where needed. Verify private responses remain `no-store`.
- Document key rotation, cron-secret rotation, deployment rollback, Supabase backup restore, and incident response.

Acceptance criteria:
- CI fails on lint, tests, build, critical/high production dependency findings, or smoke-test failure.
- A strict CSP is present in production without breaking login, MFA, receipts, charts, or exports.
- `pnpm audit --prod` has no unreviewed high/critical findings.
- All existing 57 financial/auth tests continue to pass.
- Provide a manual settings checklist for GitHub/Vercel/Supabase actions that cannot be committed as code.
```

### Prompt 3 — Harden passwordless authentication and recovery

```text
Act as a product security lead and authentication UX specialist. Polish Gorilla Ledger’s passwordless email-code and MFA journey while preserving anti-enumeration behavior and cross-device code entry.

Requirements:
- Replace the in-memory Map rate limiter with a distributed, atomic rate limiter suitable for Vercel serverless execution. Rate-limit by normalized email, IP/risk signal, and endpoint, with privacy-safe retention and clear Retry-After behavior.
- Avoid listing the entire Supabase user population to determine account existence. Use a scalable server-side lookup or a documented Supabase-supported pattern that keeps responses enumeration-safe.
- Keep the manual code-entry path available at all times, but make the screen progressive: request code is the primary state; after a request, focus code entry, show the destination in masked form, show an accurate resend timer, and explain that only the newest code works.
- Preserve generic public responses, but record privacy-redacted internal delivery outcomes, latency, provider ID, and failure class. Add an actionable recovery path when delivery is delayed without exposing whether an account exists.
- Reconcile multiple emails with identical subjects so users can identify the newest code by timestamp. Consider including the request reference in the email footer, not in the code itself.
- Add browser tests for existing account, unknown account, expired code, reused code, resend, wrong code, cross-device entry, MFA step-up, multiple authenticators, and auth-provider outage.
- Replace the security score with concrete risk states. Zero verified factors must never be labeled reassuringly. Explain backup-authenticator and account-recovery policy clearly.

Acceptance criteria:
- End-to-end flow remains email code → MFA when AAL2 is required → sanitized destination.
- Rate limits work across concurrent serverless instances and survive cold starts.
- No public response reveals account existence or provider delivery outcome.
- Keyboard and screen-reader users receive correct focus and status updates.
- Auth confirmation and MFA route performance is measurably improved from RES 60 and 69 respectively.
```

### Prompt 4 — Turn the dashboard into a calm decision surface

```text
Act as Gorilla Ledger’s Product Lead and information-design lead. Redesign the dashboard hierarchy so it fulfills the public promise of “quiet intelligence.” Do not remove financial capability; progressively disclose it.

Requirements:
- Define a single top-level answer for the selected month: current position, what changed, and the one most important next action.
- Keep the four core financial KPIs, but reduce duplicate warnings across Monthly Overview, Financial Health, Smart Alerts, Executive Insights, Smart Insights, and AI Coach.
- Merge overlapping intelligence panels into one prioritized “What needs attention” area with at most three actions. Put methodology and deeper diagnostics behind disclosure.
- Standardize status vocabulary, thresholds, and semantic color: Healthy, Watch, At risk, Critical. A score cannot display conflicting labels.
- Reconcile forecast-confidence label and supporting copy. “Reliable” must not tell users to add more data to improve confidence unless the copy explains a higher target.
- If the guidance is deterministic, rename “AI Coach” and “model-driven” to accurate language such as “Guidance” or “Ledger insights.” If genuine model inference exists, disclose data boundaries and uncertainty.
- On mobile, default advanced analytics closed; keep the current accordion foundation but show a concise summary and preserve user expansion state.
- Make negative cash flow and negative balances scannable with restrained semantic color and icons, not color alone.
- Keep every currency isolated unless an approved FX layer is explicitly active.

Acceptance criteria:
- The same warning is not restated in more than one primary panel.
- Above-the-fold content answers position, movement, and next action without scrolling on common desktop widths.
- Mobile users reach recent activity and the first recommendation with materially less scrolling.
- All status copy is generated from one typed source of truth with unit tests for boundaries and contradictory states.
- Existing reconciliation and currency-isolation tests continue to pass.
```

### Prompt 5 — Polish core money-entry and record-management workflows

```text
Act as a senior fintech product designer and engineer. Polish Gorilla Ledger’s wallet, category, transaction, transfer/FX, budget, receipt, and recurring-rule workflows for speed, clarity, and irreversible-action safety.

Requirements:
- Transaction type and category must stay semantically aligned. Filter categories by the selected type or automatically reconcile the type when a category changes, and enforce the invariant in the database/RPC layer.
- Present paired transfers and FX as one balance-movement event in the timeline, with expandable source/destination legs. Do not label them as ordinary income and expense.
- Add duplicate-detection guidance for wallet names and transaction submissions. Distinguish duplicate wallet names with institution/account alias and currency.
- Move destructive actions into secondary menus. Before deletion, explain dependent transactions/budgets/rules/receipts. Provide undo where deletion can be safely soft-reversed.
- Add edit support for recurring rules, including a preview of the next three occurrences and explicit timezone/day-clamping behavior.
- Replace “100% reliability” for one run with sample-aware language such as “1 of 1 successful.” Hide raw transaction UUIDs from normal users while retaining a copyable support reference in a diagnostic disclosure.
- Enforce receipt size and allowed MIME types server-side before signing uploads, verify object ownership after upload, and keep the 5 MB UI promise accurate.
- Improve form focus, inline validation, optimistic feedback, double-submit prevention, and recovery after partial failure.

Acceptance criteria:
- Income/expense category mismatches cannot be created through UI, API, RPC, or direct authenticated database calls.
- Transfers/FX remain excluded from operating income, expense, and budgets and are visually paired.
- Recurring rules can be edited without duplicating past transactions.
- Destructive-action tests cover dependencies, cancellation, and failure recovery.
- Receipt validation cannot be bypassed by calling the signing API directly.
```

### Prompt 6 — Accessibility, responsive design, and visual-system refinement

```text
Act as an accessibility lead and premium product designer. Bring Gorilla Ledger to a documented WCAG 2.2 AA baseline across public, auth, and protected application surfaces while preserving the black-and-white brand.

Requirements:
- Audit and fix text contrast, especially small gray descriptions, uppercase eyebrows, timestamps, chart labels, account metadata, and disabled controls.
- Set minimum readable type sizes and line heights. Reduce excessive uppercase tracking and repeated pills where they flatten hierarchy.
- Ensure all interactive targets are at least 44×44 CSS pixels on touch surfaces and have visible keyboard focus that is not clipped by glass cards.
- Test skip links, heading order, landmarks, dialog/form focus, mobile More navigation, Escape handling, and post-navigation focus.
- Preserve accessible chart summaries, but verify every chart has a useful name, text alternative, keyboard-reachable controls, and no information conveyed by color alone.
- Refine the desktop top bar: prioritize product navigation, move account/security metadata into an account menu, and maintain a persistent but less noisy security indicator.
- Validate 320, 375, 390, 768, 1024, 1280, and 1440 px widths, zoom to 200%, reduced motion, increased contrast, and long email/category/wallet names.
- Add Playwright plus axe checks for public home, login, dashboard, wallets, categories, transactions, budgets, recurring, exports, family, and security.

Acceptance criteria:
- No critical or serious automated accessibility violations on audited routes.
- All workflows are keyboard-completable with logical focus order.
- No horizontal page overflow at tested widths or 200% zoom.
- Reduced-motion users do not receive decorative fade/lift animation.
- The mobile bottom navigation respects safe-area insets and never covers page actions or validation messages.
```

### Prompt 7 — Strengthen household roles, auditability, and account safety

```text
Act as the product and security lead for Gorilla Ledger household collaboration. Clarify the difference between application administration and ledger ownership, and introduce trustworthy collaboration controls.

Context: the inspected `admindau@proton.me` and `dau_atem@proton.me` accounts each own separate ledgers. Current household roles are owner and editor; there is no global admin experience in the product.

Requirements:
- Use “ledger owner” consistently. Do not imply a global admin role unless an actual, separately secured operator console exists.
- Add a viewer role and evaluate a contributor role with limited write permissions. Keep ownership transfer as a separately protected, re-authenticated flow.
- Give owners granular control over receipts, exports, member management, and destructive financial actions.
- Add an immutable household activity log for invitations, joins, removals, wallet/category/budget/rule changes, transaction edits/deletes, exports, and security-sensitive events. Redact sensitive receipt content and auth secrets.
- Make invitation status, expiry, resend, revoke, and accepted identity visible. Do not expose raw invitation tokens.
- Require MFA or recent step-up authentication for ownership transfer, bulk export, member removal, and other high-impact actions.
- Add tests proving editors/viewers cannot cross ledger boundaries or escalate privileges.

Acceptance criteria:
- Role capabilities are defined once and enforced in UI, API, RPC, and RLS.
- Every high-impact household mutation creates an audit event with actor, ledger, event, timestamp, and safe metadata.
- Cross-household access tests cover receipts, exports, recurring rules, and paired transfers.
- Product copy clearly distinguishes account identity, ledger membership, and ledger ownership.
```

### Prompt 8 — Create a distinctive premium brand and public proof layer

```text
Act as Gorilla Ledger’s Brand Director and growth-oriented Product Lead. Evolve the public experience from elegant teaser to credible premium finance product without using hype, fake testimonials, or invented compliance claims.

Requirements:
- Create a distinct Gorilla Ledger product mark and favicon system. Keep Savvy Rilla Technologies as an endorsed parent brand, but stop letting the parent-company Africa artwork dominate the product hero.
- Preserve the restrained monochrome direction while adding one controlled semantic/accent palette for trust, positive movement, caution, and critical states.
- Add authentic product proof: a privacy-safe dashboard preview, a three-step money workflow, multi-currency differentiation, passwordless/MFA security explanation, private export explanation, and family collaboration model.
- Clarify CTAs. Anonymous users should see one primary “Create ledger” action and one secondary “Sign in” action. Authenticated users should see “Open dashboard.”
- Explain who the product is for and why currencies are never silently mixed. Avoid unqualified “AI,” “certified,” “secure,” or “private by design” claims; support each claim with a concrete mechanism.
- Improve Open Graph/Twitter imagery, structured metadata, manifest icons, and link previews.
- Maintain excellent mobile composition and fast public-page loading.

Acceptance criteria:
- Product and parent-company identities are visually distinct but related.
- Public copy accurately reflects implemented features and security controls.
- The landing page demonstrates the product before asking for account creation.
- Public-route LCP remains below 2.0 s in lab tests and no new CLS is introduced.
```

### Prompt 9 — Complete portability, recurring automation, and trust controls

```text
Act as a fintech reliability and data-portability lead. Make Gorilla Ledger feel safe to depend on for years.

Requirements:
- Add a one-click complete export archive containing versioned CSV datasets, a manifest, schema version, currency conventions, timezone conventions, receipt metadata, recurring schedules, household membership metadata, and integrity checksums. Do not place active auth or invitation secrets in exports.
- Design and implement a validated import/restore preview that reports creates, updates, conflicts, skipped rows, and irreversible consequences before applying changes.
- Add receipt export/download with explicit user confirmation and clear privacy warnings.
- Add recurring-rule execution idempotency guarantees, retry policy, dead-letter visibility, duplicate prevention, and alerting for failures.
- Show sample-aware recurring reliability, next-run timezone, last successful run, failure reason in plain language, and a support reference behind disclosure.
- Document and test database backup restoration separately from user-facing export/import.

Acceptance criteria:
- A full export can be validated offline using the manifest and checksums.
- Import never silently merges currencies, changes dates due to timezone, evaluates spreadsheet formulas, or duplicates paired transfers/recurring runs.
- Recurring execution remains idempotent across retries and overlapping cron invocations.
- Restore drills are documented and testable in a non-production Supabase project.
```

### Prompt 10 — Add product observability, end-to-end tests, and operating documentation

```text
Act as Gorilla Ledger’s engineering manager and site reliability lead. Build the operating system required to ship a trustworthy finance product repeatedly.

Requirements:
- Replace the default Create Next App README with product architecture, prerequisites, environment-variable names, local setup, Supabase migrations, test commands, deployment flow, security model, data model, cron behavior, and troubleshooting. Never document secret values.
- Add Playwright end-to-end tests for registration, login, MFA, dashboard loading, wallet/category creation, income/expense entry, paired transfer/FX, budget calculation, recurring-rule lifecycle, receipts, exports, household invitation, and role boundaries. Use dedicated test data and teardown.
- Add privacy-redacted error monitoring and structured logs with request correlation. Never log access tokens, OTPs, invite tokens, signed URLs, receipt contents, raw descriptions, or full email addresses.
- Add synthetic production checks for public home, login availability, authenticated smoke path, Supabase connectivity, and recurring-cron health. Do not use a real personal ledger for automation.
- Define SLOs and alerts for login-code delivery, authenticated route errors, API latency, cron failures, and backup age.
- Add route performance budgets and report Web Vitals by route/device. Track dashboard, auth confirmation, MFA, recurring, and exports as first-priority routes.
- Inspect and resolve the visible Supabase API/auth warnings and document the result.

Acceptance criteria:
- Pull requests show CI, browser smoke, security scan, and performance-budget status.
- Production incidents can be traced with a correlation ID without exposing financial or authentication data.
- A new engineer can run, test, migrate, and deploy the application from the README and runbooks.
- SLO dashboards and alert ownership are documented.
```

## Suggested execution order

1. Prompt 1 — loading and CLS
2. Prompt 2 — security and CI
3. Prompt 3 — authentication hardening
4. Prompt 4 — dashboard hierarchy
5. Prompt 5 — money-entry workflows
6. Prompt 6 — accessibility and responsive refinement
7. Prompt 7 — household roles and audit log
8. Prompt 8 — brand and public proof
9. Prompt 9 — portability and recurring reliability
10. Prompt 10 — observability and operating maturity

Prompts 1–3 should be implemented as separate pull requests because they affect performance architecture, security policy, and authentication. Prompt 4 should follow the loading work so visual redesign does not preserve the current layout-shift causes. Prompts 5–7 require migration planning and should include rollback-safe database changes. Prompts 8–10 can proceed after the trust foundation is stable.
