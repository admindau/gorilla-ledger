import Link from "next/link";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";

export default function LegacyResetPasswordPage() {
  return (
    <PublicAuthShell>
      <div className="flex w-full items-center justify-center px-4 text-white">
      <div className="gl-auth-card gl-card w-full max-w-md">
        <div className="gl-auth-card-heading">
          <p className="gl-auth-eyebrow">No password to reset</p>
          <h1>Use a secure one-time code</h1>
          <p>Gorilla Ledger does not store account passwords. Request a fresh code to return to your ledger securely.</p>
        </div>
        <Link href="/auth/login" className="gl-btn gl-btn-primary gl-btn-md w-full">Continue to sign in</Link>
        <p className="gl-auth-card-footer">Need help? <Link href="/contact" className="gl-auth-text-link">Contact support</Link></p>
      </div>
      </div>
    </PublicAuthShell>
  );
}
