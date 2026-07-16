# Ledger integrity deployment

Apply `supabase/migrations/20260716090000_ledger_integrity.sql` before deploying the application commit that accompanies it.

The migration:

- adds durable operational, transfer, and FX transaction semantics;
- backfills transfer/FX meaning from existing category names;
- adds recurring-rule occurrence provenance and a uniqueness constraint;
- provides the atomic `create_wallet_transfer` function used by the transaction screen.

After deployment, correct the existing `Bought $100 @ SSP750,000` income transaction through the transaction editor by changing its wallet from the SSP cash wallet to the USD cash wallet. This is deliberately not performed by the migration because financial records must not be changed using a description-based guess.

Verify afterward:

1. The transaction displays `100.00 USD`.
2. The SSP total decreases by `100.00` from the pre-correction stored position.
3. The USD total increases by `100.00`.
4. FX rows remain visible in activity but do not appear in operating income, expenses, net flow, or budget consumption.
5. A new Transfer / FX entry creates two rows with the same transfer identifier and changes only wallet balances.
