# Phase D — Expansion and Export Center

Phase D expands Gorilla Ledger from an in-app financial command center into a portable financial record system.

## Export Center

The authenticated Export Center provides separate CSV datasets for:

- Transactions
- Wallets
- Categories
- Budgets
- Recurring rules

Every dataset is built from the complete paginated result set rather than the first database response page.

## Trust boundaries

- Supabase row-level security remains the source authorization boundary.
- Export generation occurs locally in the authenticated browser.
- No ledger records are sent to a third-party export service.
- Currency codes and integer minor-unit values remain explicit.
- Human-readable decimal amounts are included alongside minor units.
- Wallet and category names are resolved without removing their stable IDs.
- User-generated spreadsheet formulas are neutralized to prevent CSV injection.
- Empty datasets cannot trigger misleading blank downloads.
- UTF-8 byte-order marks improve compatibility with spreadsheet applications.

## Product scope

This phase deliberately ships CSV first. Excel workbooks, PDF statements, and automated delivery remain later roadmap items because they require additional formatting, rendering, and delivery certification.

## Automated coverage

The export tests certify:

- All five datasets are generated
- Row counts reconcile
- Wallet and category names resolve correctly
- Currency and minor-unit fields remain explicit
- Spreadsheet formulas are neutralized
- Safe user text remains unchanged

Run the complete release gate with:

```bash
pnpm certify
```
