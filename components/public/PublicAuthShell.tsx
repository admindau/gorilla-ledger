import type { ReactNode } from "react";
import Image from "next/image";
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
        <Link href="/" aria-label="Gorilla Ledger home">
          <span className="gl-public-brand-mark" aria-hidden="true">
            <Image src="/logos/gorilla-ledger-logo-polished.png" alt="" width={32} height={32} priority />
          </span>
          <span>{PRODUCT_NAME}</span>
        </Link>
        <span>Secure account access</span>
      </header>
      <main id="main-content" className="gl-public-auth-main" tabIndex={-1}>{children}</main>
      <PublicFooter compact />
    </div>
  );
}
