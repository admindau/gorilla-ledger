"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

export function LoginForm({
  next,
  initialError = "",
}: {
  next: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError);
  const [successMsg, setSuccessMsg] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [reference, setReference] = useState("");
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (successMsg) codeInputRef.current?.focus();
  }, [successMsg]);

  const maskedDestination = email.trim().replace(/^(.)([^@]*)(@.*)$/, (_, first, middle, domain) =>
    `${first}${"•".repeat(Math.min(5, Math.max(2, middle.length)))}${domain}`
  );

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
        setErrorMsg(body.message ?? "We could not send a sign-in code. Please try again.");
        return;
      }

      setSuccessMsg(
        body.message ??
          "Check your email for a secure sign-in link. You can close this tab after opening it."
      );
      setOtp("");
      setReference(typeof body.reference === "string" ? body.reference.slice(0, 8) : "");
      setResendIn(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
    } catch {
      setErrorMsg("We could not send a sign-in code. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim()) {
      setErrorMsg("Enter the email address that received the code.");
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch("/auth/confirm/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          token: otp.replace(/\s/g, ""),
          type: "magiclink",
        }),
      });

      if (!response.ok) {
        setErrorMsg("That code is invalid or expired. Use the code from the newest email, or request another one.");
        return;
      }

      window.location.replace(next);
    } catch {
      setErrorMsg("We could not verify that code. Check your connection and try again.");
    } finally {
      setVerifying(false);
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
        <h1>Sign in securely</h1>
        <p>We&apos;ll email you a one-time code—no password or link required.</p>
      </div>

      {errorMsg && (
        <p className="gl-auth-alert gl-auth-alert-error" role="alert">
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <div className="gl-auth-alert gl-auth-alert-success" role="status">
          <p>{successMsg}</p>
          <p className="mt-2 text-xs font-medium text-white/80">Sent to {maskedDestination}</p>
          <p className="mt-2 text-xs leading-5 text-white/65">
            Enter the code below on this computer. Search all mail folders for hello@savvyrilla.tech if it is not visible,
            and use only the newest code.
          </p>
          {reference ? <p className="mt-2 text-[11px] text-white/45">Request reference: {reference}</p> : null}
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
          {loading ? "Sending secure code…" : successMsg ? "Code sent" : "Email me a sign-in code"}
        </button>
      </form>

      <form onSubmit={verifyCode} className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <div>
            <p className="gl-auth-eyebrow">Already have a code?</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Enter the email address above, then type the code from your newest Gorilla Ledger email.
            </p>
          </div>
          <div>
            <label htmlFor="login-code" className="gl-label">Sign-in code</label>
            <input
              id="login-code"
              ref={codeInputRef}
              className="gl-input text-center text-xl tracking-[0.28em]"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              minLength={6}
              maxLength={8}
              required
              aria-describedby="login-code-help"
            />
            <p id="login-code-help" className="mt-2 text-xs leading-5 text-white/55">
              Type the 6–8 digit code from the newest Gorilla Ledger email.
            </p>
          </div>
          <button type="submit" disabled={verifying} className="gl-btn gl-btn-primary gl-btn-md w-full">
            {verifying ? "Verifying code…" : "Continue with code"}
          </button>
      </form>

      <p className="gl-auth-legal">
        Codes are single-use and expire automatically. If one has expired, request a fresh email here.
      </p>

      {successMsg ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
          <button
            type="button"
            disabled={loading || resendIn > 0}
            onClick={() => void sendMagicLink()}
            className="gl-auth-text-link disabled:cursor-not-allowed disabled:opacity-45"
          >
            {resendIn > 0 ? `Send another email in ${resendIn}s` : "Send another email"}
          </button>
          <button
            type="button"
            onClick={() => { setSuccessMsg(""); setEmail(""); setOtp(""); setReference(""); setResendIn(0); }}
            className="gl-auth-text-link"
          >
            Use a different email address
          </button>
        </div>
      ) : null}

      <div className="gl-auth-card-footer">
        New to Gorilla Ledger?{" "}
        <Link href="/auth/register" className="gl-auth-text-link">
          Create an account
        </Link>
      </div>
    </div>
  );
}
