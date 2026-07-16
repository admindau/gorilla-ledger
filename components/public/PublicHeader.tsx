import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";
import { PublicNav } from "@/components/public/PublicNav";

export function PublicHeader() {
  return (
    <header className="gl-public-header">
      <div className="gl-public-header-inner">
        <Link href="/" className="gl-public-brand" aria-label="Gorilla Ledger home">
          {PRODUCT_NAME}
        </Link>

        <PublicNav />

        <Link href="/dashboard" className="gl-btn gl-btn-secondary gl-btn-sm">
          Open app
        </Link>
      </div>
    </header>
  );
}
