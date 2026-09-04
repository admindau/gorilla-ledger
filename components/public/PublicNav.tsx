"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/about", label: "About" },
  { href: "/security", label: "Security" },
  { href: "/contact", label: "Contact" },
] as const;

export function PublicNav() {
  const pathname = usePathname();

  const items = links.map((link) => {
    const active = pathname === link.href;
    return (
      <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
        {link.label}
      </Link>
    );
  });

  return (
    <>
    <nav className="gl-public-nav" aria-label="Public navigation">
      {items}
    </nav>
    <details className="gl-public-mobile-nav">
      <summary aria-label="Open site navigation">Menu</summary>
      <nav aria-label="Mobile public navigation">{items}</nav>
    </details>
    </>
  );
}
