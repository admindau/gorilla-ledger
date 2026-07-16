import Link from "next/link";

const footerGroups = [
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

export function PublicFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={["gl-public-footer", compact ? "gl-public-footer-compact" : ""].filter(Boolean).join(" ")}>
      <div className="gl-public-footer-inner">
        <div>
          <Link href="/" className="gl-public-footer-brand">Gorilla Ledger™</Link>
          <p>A product of Savvy Rilla Technologies.</p>
        </div>

        <div className="gl-public-footer-links">
          {footerGroups.map((group) => (
            <div key={group.label}>
              <p>{group.label}</p>
              <div>
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href}>{link.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="gl-public-footer-copy">© {new Date().getFullYear()} Savvy Rilla Technologies.</p>
      </div>
    </footer>
  );
}
