"use client";

import { FormEvent, useEffect, useState } from "react";
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
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(
      () => setResendIn((seconds) => Math.max(0, seconds - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);

  async function sendMagicLink() {
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
      const retryAfter = Number(response.headers.get("Retry-After"));

      if (!response.ok && response.status !== 429) {
        setErrorMsg(body.message ?? "We could not send a secure link. Please try again.");
        return;
      }

      setSuccessMsg(
        body.message ??
          "Check your email for a secure sign-in link. You can close this tab after opening it."
      );
      setResendIn(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
    } catch {
      setErrorMsg("We could not send a secure link. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMagicLink();
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
        <div className="gl-auth-alert gl-auth-alert-success" role="status">
          <p>{successMsg}</p>
          <p className="mt-2 text-xs leading-5 text-white/65">
            Look in Focused, Other, and Junk, or search for no-reply@savvyrilla.tech.
            If you requested more than one email, open only the newest link.
          </p>
        </div>
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
            inputMode="email"
            spellCheck={false}
            aria-describedby="login-email-help"
            autoFocus
          />
          <p id="login-email-help" className="mt-2 text-xs leading-5 text-white/55">
            Use the address already connected to your ledger.
          </p>
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
        Links are single-use and expire automatically. If one has expired, request a fresh link here.
      </p>

      {successMsg ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
          <button
            type="button"
            disabled={loading || resendIn > 0}
            onClick={() => void sendMagicLink()}
            className="gl-auth-text-link disabled:cursor-not-allowed disabled:opacity-45"
          >
            {resendIn > 0 ? `Send another link in ${resendIn}s` : "Send another link"}
          </button>
          <button
            type="button"
            onClick={() => { setSuccessMsg(""); setEmail(""); setResendIn(0); }}
            className="gl-auth-text-link"
          >
            Use a different email address
          </button>
        </div>
      ) : null}

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
