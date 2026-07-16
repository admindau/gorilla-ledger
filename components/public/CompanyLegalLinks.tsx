import Link from "next/link";

const links = [
  { href: "/about", label: "About", detail: "Who builds Gorilla Ledger" },
  { href: "/contact", label: "Contact", detail: "Support and security reports" },
  { href: "/privacy", label: "Privacy", detail: "How information is handled" },
  { href: "/terms", label: "Terms", detail: "Rules for using the service" },
] as const;

export function CompanyLegalLinks() {
  return (
    <section className="gl-premium-card p-5" aria-labelledby="company-legal-title">
      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Gorilla Ledger</p>
      <h2 id="company-legal-title" className="mt-1 text-lg font-semibold text-white">Company &amp; legal</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="gl-company-link">
            <span>{link.label}</span>
            <small>{link.detail}</small>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
