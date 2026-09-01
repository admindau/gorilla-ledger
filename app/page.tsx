import Link from "next/link";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PRODUCT_NAME } from "@/lib/brand";

export default function HomePage() {
  return (
    <div className="gl-public-shell">
      <a className="gl-skip-link" href="#main-content">Skip to main content</a>
      <PublicHeader />
      <main id="main-content" className="gl-home-hero">
        <div className="gl-home-hero-inner">
          <section className="gl-home-copy" aria-labelledby="home-title">
            <p className="gl-home-eyebrow">
              <span aria-hidden="true" /> Personal finance, made legible
            </p>
            <h1 id="home-title">Know where your money stands.</h1>
            <p className="gl-home-lede">
              {PRODUCT_NAME} gives you a calm, precise view of every wallet,
              currency, and transaction—without the clutter of traditional finance apps.
            </p>

            <div className="gl-home-actions">
              <Link href="/auth/register" className="gl-btn gl-btn-primary gl-btn-lg">
                Create ledger <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/auth/login" className="gl-btn gl-btn-secondary gl-btn-lg">
                Sign in
              </Link>
            </div>

            <p className="gl-home-assurance">
              Passwordless access <span aria-hidden="true">·</span> Optional MFA <span aria-hidden="true">·</span> Currency-safe totals
            </p>
          </section>

          <aside className="gl-home-showcase" aria-label="Privacy-safe Gorilla Ledger dashboard preview">
            <div className="gl-home-showcase-glow" aria-hidden="true" />
            <div className="gl-product-preview">
              <div className="gl-product-preview-bar"><span>Monthly overview</span><strong>September</strong></div>
              <div className="gl-product-preview-position"><span>Position</span><strong>Healthy</strong><p>Each currency stays separate.</p></div>
              <div className="gl-product-preview-grid">
                <div><span>Income</span><strong>4,820 USD</strong></div>
                <div><span>Expenses</span><strong>2,940 USD</strong></div>
                <div><span>Net flow</span><strong>+1,880 USD</strong></div>
                <div><span>Budget</span><strong>68% used</strong></div>
              </div>
              <div className="gl-product-preview-signal"><span aria-hidden="true">!</span><div><strong>What needs attention</strong><p>One upcoming payment needs review.</p></div></div>
            </div>
            <div className="gl-home-showcase-caption">
              <div>
                <span>Private product preview</span>
                <strong>No real financial data</strong>
              </div>
              <span className="gl-home-monogram" aria-hidden="true">GL</span>
            </div>
          </aside>
        </div>

        <div className="gl-home-feature-rail" aria-label="Product highlights">
          <div><span>01</span><strong>One clear picture</strong><p>Balances and activity stay reconciled.</p></div>
          <div><span>02</span><strong>Every currency</strong><p>Track value without flattening context.</p></div>
          <div><span>03</span><strong>Quiet intelligence</strong><p>Useful signals, never dashboard noise.</p></div>
        </div>

        <section className="gl-home-proof" aria-labelledby="proof-title">
          <div className="gl-home-proof-heading"><span>How it works</span><h2 id="proof-title">A ledger you can understand—and leave with.</h2></div>
          <div className="gl-home-proof-grid">
            <article><span>01</span><h3>Record clearly</h3><p>Create wallets by currency, then add income, expenses, transfers, receipts, and recurring rules.</p></article>
            <article><span>02</span><h3>Review calmly</h3><p>See reconciled balances, budget pressure, and at most three priority signals without silently mixing currencies.</p></article>
            <article><span>03</span><h3>Keep control</h3><p>Use passwordless codes, add authenticator MFA, collaborate with separate accounts, and export versioned CSV data.</p></article>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
