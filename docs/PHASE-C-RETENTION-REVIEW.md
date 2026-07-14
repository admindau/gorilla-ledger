# Phase C — Retention and Monthly Review

Phase C creates a repeatable reason to return: understand what changed, decide what matters, and take one useful follow-up action.

## Monthly return loop

For the month selected on the dashboard, Gorilla Ledger now:

1. Compares income, expenses, net flow, and activity with the preceding calendar month.
2. Keeps every calculation and comparison separated by currency.
3. Identifies whether spending is higher, lower, stable, new, or lacks a prior baseline.
4. Prioritizes one follow-up using the order below.
5. Exports the review as a currency-explicit CSV for personal records or further analysis.

## Follow-up priority

1. Record activity when the selected month is empty.
2. Review transactions when any currency has negative cash flow.
3. Create a budget when the month has no budget coverage.
4. Inspect spending when expenses increased by at least 20% against a valid baseline.
5. Continue building history when no higher-priority issue exists.

This ordering prevents a lower-value enhancement from obscuring an immediate cash-flow issue.

## Experience rules

- Show Monthly Review only after the core ledger is activated.
- Respect the dashboard’s selected month, including historical months.
- Compare January with December of the previous calendar year.
- Never manufacture a percentage when the preceding value is zero.
- Never aggregate or export money across currencies.
- Keep export user-initiated and perform it locally in the browser.

## Automated coverage

The retention tests certify:

- Currency-isolated comparisons
- Calendar-year rollover
- Follow-up priority
- Empty-month behavior
- Spending-pressure detection
- Currency-explicit CSV output

Run the complete release gate with:

```bash
pnpm certify
```
