"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({
  next,
  initialError = "",
}: {
  next: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError);
  const [successMsg, setSuccessMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
      const { error } = await supabaseBrowserClient.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo,
          shouldCreateUser: false,
        },
      });

      if (error) {
        setErrorMsg(
          error.message.toLowerCase().includes("signups not allowed")
            ? "We could not find a Gorilla Ledger account for that email."
            : error.message
        );
        return;
      }

      setSuccessMsg(
        "Check your email for a secure sign-in link. You can close this tab after opening it."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gl-auth-card gl-card w-full max-w-md">
      <div className="gl-auth-card-heading">
        <p className="gl-auth-eyebrow">Welcome back</p>
        <h1>Sign in with a magic link</h1>
        <p>No password to remember. We&apos;ll email you a secure, one-time link.</p>
      </div>

      {errorMsg && (
        <p className="gl-auth-alert gl-auth-alert-error" role="alert">
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <p className="gl-auth-alert gl-auth-alert-success" role="status">
          {successMsg}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div>
          <label htmlFor="login-email" className="gl-label">Email address</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="gl-input"
            placeholder="name@company.com"
            autoComplete="email"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={loading || Boolean(successMsg)}
          className="gl-btn gl-btn-primary gl-btn-md w-full mt-2"
        >
          {loading ? "Sending secure link…" : successMsg ? "Magic link sent" : "Email me a magic link"}
        </button>
      </form>

      <p className="gl-auth-legal">
        Magic links are single-use and expire automatically. Only open links you requested.
      </p>

      <div className="gl-auth-card-footer">
        New to Gorilla Ledger?{" "}
        <button
          type="button"
          onClick={() => router.push("/auth/register")}
          className="gl-auth-text-link"
        >
          Create an account
        </button>
      </div>
    </div>
  );
}
