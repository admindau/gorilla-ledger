# Phase B — Activation and Clarity

Phase B gives every new ledger a clear route from an empty account to useful financial intelligence.

## Activation model

The journey has five evidence-backed milestones:

1. Establish a wallet.
2. Maintain at least one income and one expense category.
3. Record the first transaction.
4. Create a monthly budget.
5. Activate a recurring rule.

The first three milestones define a usable core ledger. Budgets and recurring rules enhance planning and forecast confidence without blocking core activation.

Progress is derived from verified ledger records on every dashboard load. It is not stored as a dismissible browser preference, so it cannot drift away from the user’s actual data.

## Experience rules

- Show one recommended next action, in journey order.
- Explain why each step matters instead of exposing raw feature names alone.
- Never present a usable form when its wallet or category prerequisites are missing.
- Link missing prerequisites directly to the page where the user can resolve them.
- Keep income transactions paired with income categories and expenses paired with expense categories.
- Restrict budgets to expense categories and derive recurring flow type from its selected category.
- Reject zero, invalid, or mismatched entries before sending them to the ledger.
- Collapse the guide to one compact enhancement prompt after core activation.
- Remove the activation guide after all five milestones are evidenced by data.

## Automated coverage

The activation tests certify:

- Correct first recommended action for an empty account
- Both category types are required for classification readiness
- Core activation occurs after wallet, taxonomy, and activity
- Planning and automation complete the full journey
- Invalid counts cannot create false progress

Run the complete release gate with:

```bash
pnpm certify
```
