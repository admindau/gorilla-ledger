import Link from "next/link";

const links = [
  { href: "/about", label: "About" },
  { href: "/security", label: "Security" },
  { href: "/contact", label: "Contact" },
] as const;

export function PublicHeader() {
  return (
    <header className="gl-public-header">
      <div className="gl-public-header-inner">
        <Link href="/" className="gl-public-brand" aria-label="Gorilla Ledger home">
          Gorilla Ledger™
        </Link>

        <nav className="gl-public-nav" aria-label="Public navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href="/auth/login" className="gl-btn gl-btn-secondary gl-btn-sm">
          Login
        </Link>
      </div>
    </header>
  );
}
