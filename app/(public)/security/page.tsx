import type { Metadata } from "next";
import Link from "next/link";
import { TrustPage, TrustSection } from "@/components/public/TrustPage";
import { SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Security",
  description: "How Gorilla Ledger protects accounts and financial records.",
};

export default function SecurityPage() {
  return (
    <TrustPage
      eyebrow="Security"
      title="Protection built into the ledger."
      description="Gorilla Ledger combines account security, scoped data access, and conservative financial calculations to protect both access and accuracy."
      updated="16 July 2026"
    >
      <section className="gl-security-principles" aria-label="Security principles">
        <div><span>01</span><h2>Account protection</h2><p>Email verification and optional multi-factor authentication help prevent unauthorized access.</p></div>
        <div><span>02</span><h2>Data separation</h2><p>User-scoped access controls keep authenticated ledger records separated by account.</p></div>
        <div><span>03</span><h2>Protected files</h2><p>Receipt uploads use controlled access rather than permanent public file links.</p></div>
        <div><span>04</span><h2>Local exports</h2><p>CSV exports are generated in your browser and are not sent to an additional export service.</p></div>
      </section>

      <TrustSection title="Financial-data integrity">
        <p>
          Security also means protecting the meaning of your records. Gorilla Ledger keeps currencies separate, excludes internal transfers from operating income and expenses, uses strict amount parsing, and hides totals when required data cannot be verified.
        </p>
      </TrustSection>

      <TrustSection title="What you can do">
        <ul>
          <li>Use a strong password that you do not reuse elsewhere.</li>
          <li>Enable MFA and configure a backup authenticator.</li>
          <li>Review account security regularly.</li>
          <li>Export important records and store the files securely.</li>
          <li>Contact us immediately if you suspect unauthorized access.</li>
        </ul>
      </TrustSection>

      <TrustSection title="Responsible disclosure">
        <p>
          If you believe you have found a vulnerability, email <a href={`mailto:${SUPPORT_EMAIL}?subject=Gorilla%20Ledger%20security%20report`}>{SUPPORT_EMAIL}</a>. Please do not access another person&apos;s information, disrupt the service, or publicly disclose an unresolved issue.
        </p>
        <p><Link href="/contact">See all contact options</Link>.</p>
      </TrustSection>
    </TrustPage>
  );
}
