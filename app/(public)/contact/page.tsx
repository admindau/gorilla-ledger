import type { Metadata } from "next";
import { TrustPage, TrustSection } from "@/components/public/TrustPage";

export const metadata: Metadata = {
  title: "Contact | Gorilla Ledger™",
  description: "Contact Gorilla Ledger support or report a security concern.",
};

const CONTACT_EMAIL = "hello@savvyrilla.tech";

export default function ContactPage() {
  return (
    <TrustPage
      eyebrow="Contact"
      title="How can we help?"
      description="Contact Savvy Rilla Technologies for product support, privacy questions, or responsible security reports."
    >
      <section className="gl-contact-grid" aria-label="Contact options">
        <a href={`mailto:${CONTACT_EMAIL}?subject=Gorilla%20Ledger%20support`}>
          <span>Product support</span>
          <p>Questions about your account, transactions, exports, or app behavior.</p>
          <strong>{CONTACT_EMAIL}</strong>
        </a>
        <a href={`mailto:${CONTACT_EMAIL}?subject=Gorilla%20Ledger%20privacy`}>
          <span>Privacy</span>
          <p>Questions or requests concerning your personal information.</p>
          <strong>{CONTACT_EMAIL}</strong>
        </a>
        <a href={`mailto:${CONTACT_EMAIL}?subject=Gorilla%20Ledger%20security%20report`}>
          <span>Security</span>
          <p>Report a suspected vulnerability or account-security concern privately.</p>
          <strong>{CONTACT_EMAIL}</strong>
        </a>
      </section>

      <TrustSection title="What to include">
        <p>
          Describe what happened, the page or feature involved, and any steps that help us reproduce the issue. Screenshots are useful when they do not expose sensitive information.
        </p>
        <div className="gl-trust-note">
          Never send your password, one-time authentication code, recovery information, or full financial records by email.
        </div>
      </TrustSection>

      <TrustSection title="Response expectations">
        <p>
          Messages are reviewed by Savvy Rilla Technologies. Response time depends on the nature and urgency of the request; security and account-access concerns receive priority.
        </p>
      </TrustSection>
    </TrustPage>
  );
}
