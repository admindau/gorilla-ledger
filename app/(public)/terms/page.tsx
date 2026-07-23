import type { Metadata } from "next";
import { TrustPage, TrustSection } from "@/components/public/TrustPage";
import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for using Gorilla Ledger.",
};

export default function TermsPage() {
  return (
    <TrustPage
      eyebrow="Legal"
      title="Terms of use"
      description="These terms describe the basic rules for accessing and using Gorilla Ledger."
      updated="16 July 2026"
    >
      <TrustSection title="The service">
        <p>
          Gorilla Ledger is a personal financial-record application provided by {COMPANY_NAME}. It helps users record transactions, organize wallets and categories, create budgets, schedule recurring activity, and review financial summaries.
        </p>
      </TrustSection>

      <TrustSection title="Your account">
        <ul>
          <li>Provide accurate account information and keep it current.</li>
          <li>Protect your email account, magic links, and authentication factors.</li>
          <li>Use your account only for lawful purposes.</li>
          <li>Notify us promptly if you suspect unauthorized access.</li>
        </ul>
      </TrustSection>

      <TrustSection title="Your records and responsibilities">
        <p>
          You remain responsible for the information you enter and for checking that transactions, balances, categories, currencies, and reports match your records. Maintain independent copies of information that is important to you; Gorilla Ledger provides CSV exports for this purpose.
        </p>
      </TrustSection>

      <TrustSection title="Not financial advice">
        <p>
          Gorilla Ledger provides record-keeping calculations and informational summaries. It does not provide investment, accounting, tax, legal, lending, or other professional advice. Decisions made using the service remain your responsibility.
        </p>
      </TrustSection>

      <TrustSection title="Acceptable use">
        <p>You may not misuse the service, attempt unauthorized access, interfere with its operation, upload unlawful material, or use it to harm another person or system.</p>
      </TrustSection>

      <TrustSection title="Availability and changes">
        <p>
          We work to keep Gorilla Ledger accurate and available, but uninterrupted operation is not guaranteed. Features may change as the product improves or as security, technical, or legal requirements evolve.
        </p>
      </TrustSection>

      <TrustSection title="Third-party services">
        <p>
          Gorilla Ledger depends on infrastructure and services provided by third parties, including Supabase and Vercel. Their availability and processing practices are governed by their own terms and policies.
        </p>
      </TrustSection>

      <TrustSection title="Intellectual property">
        <p>
          Gorilla Ledger, its design, software, branding, and documentation belong to {COMPANY_NAME} or its licensors. These terms do not transfer ownership of the service to you. Your ledger content remains yours.
        </p>
      </TrustSection>

      <TrustSection title="Suspension or closure">
        <p>
          Access may be limited or suspended when necessary to protect users, investigate misuse, comply with law, or maintain the service. You may contact us to request account closure.
        </p>
      </TrustSection>

      <TrustSection title="Contact">
        <p>
          Questions about these terms may be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </TrustSection>
    </TrustPage>
  );
}
