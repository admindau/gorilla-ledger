# Phase A — Trust and State Certification

Phase A makes financial correctness and honest application states release blockers.

## Certified invariants

- Money is stored and calculated in integer minor units.
- Amounts from different currencies are never added together or presented under one currency label.
- Net cash flow reconciles to income minus expenses for each currency.
- Transaction command-center totals cover the complete current month, independent of visible pagination.
- Budget actuals cover all loaded expense history, independent of the database row-page limit.
- Recurring forecasts preserve currency boundaries and clamp month-end schedules to valid calendar dates.
- Loading states never display provisional zero, empty, healthy, or setup-needed conclusions.
- Failed source queries suppress derived insights and provide an explicit retry path.

## Release gate

Run:

```bash
pnpm certify
```

The gate requires ESLint, financial certification tests, TypeScript validation, and the optimized Next.js production build to pass.

## Current automated coverage

- Currency normalization and isolation
- Unsafe monetary-value rejection
- Per-currency income, expense, and net reconciliation
- Dashboard reconciliation boundaries
- Monthly recurrence at calendar month-end
- Per-currency recurring forecast totals

Any future feature that calculates or summarizes money must add a certification test before release.
