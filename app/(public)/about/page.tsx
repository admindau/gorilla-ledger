import type { Metadata } from "next";
import Link from "next/link";
import { TrustPage, TrustSection } from "@/components/public/TrustPage";

export const metadata: Metadata = {
  title: "About | Gorilla Ledger™",
  description: "Learn why Savvy Rilla Technologies built Gorilla Ledger.",
};

export default function AboutPage() {
  return (
    <TrustPage
      eyebrow="About"
      title="Money clarity, without the noise."
      description="Gorilla Ledger is a focused personal ledger for understanding balances, cash flow, budgets, and recurring activity across currencies."
    >
      <TrustSection title="Why Gorilla Ledger exists">
        <p>
          Financial records become difficult to trust when currencies are mixed, transfers are counted as income, or important context is hidden. Gorilla Ledger is designed to keep those distinctions clear while making everyday record keeping straightforward.
        </p>
      </TrustSection>

      <TrustSection title="Our product principles">
        <ul>
          <li><strong>Accuracy first.</strong> Monetary totals remain separated by currency and internal transfers remain distinct from income and expenses.</li>
          <li><strong>Private by design.</strong> Account access is protected and exports are created locally in your browser.</li>
          <li><strong>Useful, not overwhelming.</strong> The interface prioritizes balances, activity, and decisions over technical language.</li>
          <li><strong>Portable records.</strong> Your core ledger data can be downloaded in open CSV files.</li>
        </ul>
      </TrustSection>

      <TrustSection title="Built by Savvy Rilla Technologies">
        <p>
          Gorilla Ledger is developed by Savvy Rilla Technologies, a technology company building practical digital products and infrastructure from Juba.
        </p>
        <p>
          Visit <a href="https://savvyrilla.tech" rel="noreferrer">savvyrilla.tech</a> or <Link href="/contact">contact us</Link> to learn more.
        </p>
      </TrustSection>
    </TrustPage>
  );
}
