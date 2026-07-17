import type { ReactNode } from "react";
import Link from "next/link";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PRODUCT_NAME } from "@/lib/brand";

export function PublicAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="gl-public-auth-shell">
      <a className="gl-skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="gl-public-auth-header">
        <Link href="/" aria-label="Gorilla Ledger home">{PRODUCT_NAME}</Link>
        <span>Secure account access</span>
      </header>
      <main id="main-content" className="gl-public-auth-main" tabIndex={-1}>{children}</main>
      <PublicFooter compact />
    </div>
  );
}
