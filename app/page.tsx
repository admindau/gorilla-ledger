import Image from "next/image";
import Link from "next/link";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/brand";

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
                Start your ledger <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/auth/login" className="gl-btn gl-btn-secondary gl-btn-lg">
                Sign in
              </Link>
            </div>

            <p className="gl-home-assurance">
              Private by design <span aria-hidden="true">·</span> Multi-currency ready <span aria-hidden="true">·</span> Built for clarity
            </p>
          </section>

          <aside className="gl-home-showcase" aria-label="Gorilla Ledger product identity">
            <div className="gl-home-showcase-glow" aria-hidden="true" />
            <div className="gl-home-logo-frame">
              <Image
                src="/logos/savvy-gorilla-logo.png"
                alt={`${COMPANY_NAME} mark`}
                width={360}
                height={360}
                priority
                className="gl-home-logo"
              />
            </div>
            <div className="gl-home-showcase-caption">
              <div>
                <span>Designed by</span>
                <strong>{COMPANY_NAME}</strong>
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
      </main>
      <PublicFooter />
    </div>
  );
}
