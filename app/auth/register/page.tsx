"use client";

import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/dashboard")}`;
      const { error } = await supabaseBrowserClient.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setSuccessMsg(
        "Check your email to finish creating your account. Your secure link signs you in automatically."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicAuthShell>
      <div className="flex w-full items-center justify-center px-4 text-white">
        <div className="gl-auth-card gl-card w-full max-w-md">
          <div className="gl-auth-card-heading">
            <p className="gl-auth-eyebrow">Your ledger starts here</p>
            <h1>Create your account</h1>
            <p>Enter your email and we&apos;ll send a secure link—no password required.</p>
          </div>

          {errorMsg && <p className="gl-auth-alert gl-auth-alert-error" role="alert">{errorMsg}</p>}
          {successMsg && <p className="gl-auth-alert gl-auth-alert-success" role="status">{successMsg}</p>}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="register-email" className="gl-label">Email address</label>
              <input
                id="register-email"
                type="email"
                placeholder="name@company.com"
                className="gl-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || Boolean(successMsg)}
              className="gl-btn gl-btn-primary gl-btn-md w-full"
            >
              {loading ? "Sending secure link…" : successMsg ? "Magic link sent" : "Email me a sign-up link"}
            </button>

            <p className="gl-auth-legal">
              By continuing, you agree to the <a href="/terms" className="text-gray-300 underline underline-offset-4">Terms</a> and acknowledge the <a href="/privacy" className="text-gray-300 underline underline-offset-4">Privacy Notice</a>.
            </p>
          </form>

          <p className="gl-auth-card-footer">
            Already have an account?{" "}
            <a href="/auth/login" className="gl-auth-text-link">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </PublicAuthShell>
  );
}
