import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";
import { PublicNav } from "@/components/public/PublicNav";

export function PublicHeader() {
  return (
    <header className="gl-public-header">
      <div className="gl-public-header-inner">
        <Link href="/" className="gl-public-brand" aria-label="Gorilla Ledger home">
          <span className="gl-public-brand-mark" aria-hidden="true">G</span>
          <span>{PRODUCT_NAME}</span>
        </Link>

        <PublicNav />

        <Link href="/dashboard" className="gl-btn gl-btn-secondary gl-btn-sm gl-public-open-app">
          Open ledger <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
