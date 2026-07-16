import type { Metadata } from "next";
import Link from "next/link";
import { TrustPage, TrustSection } from "@/components/public/TrustPage";
import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Gorilla Ledger handles account and financial information.",
};

export default function PrivacyPage() {
  return (
    <TrustPage
      eyebrow="Privacy"
      title="Privacy notice"
      description="This notice explains what information Gorilla Ledger uses, why it is needed, and the choices available to you."
      updated="16 July 2026"
    >
      <TrustSection title="Who is responsible">
        <p>
          Gorilla Ledger is a product of {COMPANY_NAME}. Privacy questions and requests can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </TrustSection>

      <TrustSection title="Information we use">
        <ul>
          <li><strong>Account information:</strong> your email address, authentication status, multi-factor authentication configuration, timezone, and security-review timestamps.</li>
          <li><strong>Ledger information:</strong> wallets, balances, categories, transactions, transaction notes and times, budgets, recurring rules, and related history.</li>
          <li><strong>Receipts:</strong> files you choose to attach to transactions and the records needed to retrieve or delete them.</li>
          <li><strong>Technical information:</strong> limited performance and diagnostic information used to operate, secure, and improve the application.</li>
          <li><strong>Support information:</strong> information you include when contacting us.</li>
        </ul>
      </TrustSection>

      <TrustSection title="How we use information">
        <ul>
          <li>Provide authentication, account protection, and the ledger features you request.</li>
          <li>Calculate balances, reports, budgets, forecasts, and recurring activity.</li>
          <li>Store and retrieve receipt attachments.</li>
          <li>Diagnose errors, protect the service, and improve performance.</li>
          <li>Respond to support, privacy, and security requests.</li>
        </ul>
        <p>Gorilla Ledger is not designed to use your financial records for advertising or to sell them to data brokers.</p>
      </TrustSection>

      <TrustSection title="Service providers">
        <p>
          Gorilla Ledger uses Supabase for authentication, database, and file-storage services, and Vercel for application hosting and performance monitoring. These providers process information to deliver their services to {COMPANY_NAME} and may operate infrastructure in multiple countries.
        </p>
      </TrustSection>

      <TrustSection title="Retention and deletion">
        <p>
          Account and ledger information is retained while it is needed to provide the service, meet security requirements, resolve disputes, or comply with applicable obligations. You may request account or personal-information deletion through the <Link href="/contact">contact page</Link>. Some information may remain temporarily in protected backups or where retention is legally required.
        </p>
      </TrustSection>

      <TrustSection title="Security">
        <p>
          Gorilla Ledger uses authenticated access, user-scoped database controls, multi-factor authentication options, protected receipt access, and encrypted network connections. No online service can guarantee absolute security, so you should use a strong unique password and enable MFA.
        </p>
      </TrustSection>

      <TrustSection title="Your choices and rights">
        <p>
          Depending on applicable law, you may have rights to access, correct, export, restrict, object to, or request deletion of personal information. You can export core ledger records inside the app and contact us for requests that cannot be completed there.
        </p>
      </TrustSection>

      <TrustSection title="Changes to this notice">
        <p>
          We may update this notice as the product or applicable requirements change. The current version and its revision date will remain available on this page.
        </p>
      </TrustSection>
    </TrustPage>
  );
}
