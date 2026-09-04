import Link from "next/link";
import Image from "next/image";
import { PRODUCT_NAME } from "@/lib/brand";
import { PublicNav } from "@/components/public/PublicNav";

export function PublicHeader() {
  return (
    <header className="gl-public-header">
      <div className="gl-public-header-inner">
        <Link href="/" className="gl-public-brand" aria-label="Gorilla Ledger home">
          <span className="gl-public-brand-mark" aria-hidden="true"><Image src="/logos/gorilla-ledger-logo-polished.png" alt="" width={32} height={32} priority /></span>
          <span>{PRODUCT_NAME}</span>
        </Link>

        <PublicNav />

        <Link href="/dashboard" className="gl-btn gl-btn-secondary gl-btn-sm gl-public-open-app">
          Open dashboard <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
