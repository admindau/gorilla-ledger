"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
      const response = await fetch("/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          mode: "login",
          next,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok && response.status !== 429) {
        setErrorMsg(body.message ?? "We could not send a secure link. Please try again.");
        return;
      }

      setSuccessMsg(
        body.message ??
          "Check your email for a secure sign-in link. You can close this tab after opening it."
      );
    } catch {
      setErrorMsg("We could not send a secure link. Check your connection and try again.");
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
