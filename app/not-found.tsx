import Link from "next/link";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";

export default function NotFoundPage() {
  return (
    <PublicAuthShell>
      <section className="gl-auth-card gl-card w-full max-w-lg text-center" aria-labelledby="not-found-title">
        <p className="gl-auth-eyebrow justify-center">404 · Page not found</p>
        <div className="gl-auth-card-heading mb-0">
          <h1 id="not-found-title">This page isn&apos;t in your ledger.</h1>
          <p>The address may have changed, or the page may no longer be available.</p>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="gl-btn gl-btn-secondary gl-btn-md flex-1">Go to home</Link>
          <Link href="/dashboard" className="gl-btn gl-btn-primary gl-btn-md flex-1">Open ledger</Link>
        </div>
      </section>
    </PublicAuthShell>
  );
}
