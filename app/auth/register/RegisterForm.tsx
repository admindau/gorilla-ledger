"use client";

import { useEffect, useState } from "react";

export function RegisterForm({ next, familyInvite = false }: { next: string; familyInvite?: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(
      () => setResendIn((seconds) => Math.max(0, seconds - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);

  async function sendMagicLink() {
    setErrorMsg(""); setSuccessMsg(""); setLoading(true);
    try {
      const response = await fetch("/auth/send-magic-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), mode: "signup", next }),
      });
      const body = await response.json().catch(() => ({}));
      const retryAfter = Number(response.headers.get("Retry-After"));
      if (!response.ok && response.status !== 429) {
        setErrorMsg(body.message ?? "We could not send a secure link. Please try again."); return;
      }
      setSuccessMsg(familyInvite
        ? "Check your email for a code and secure link, then continue to the shared household ledger."
        : body.message ?? "Check your email for a code and secure link to finish creating your account.");
      setOtp("");
      setReference(typeof body.reference === "string" ? body.reference.slice(0, 8) : "");
      setResendIn(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
    } catch { setErrorMsg("We could not send a secure link. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    void sendMagicLink();
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setVerifying(true);
    try {
      const response = await fetch("/auth/confirm/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: otp, type: "signup" }),
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

  return <div className="gl-auth-card gl-card w-full max-w-md">
    <div className="gl-auth-card-heading"><p className="gl-auth-eyebrow">{familyInvite ? "Create your secure account" : "Your ledger starts here"}</p><h1>{familyInvite ? "Join your family ledger" : "Create your account"}</h1><p>{familyInvite ? "Use the email address that received the invitation. We’ll send a one-time code and secure link—no shared password required." : "Enter your email and we’ll send a one-time code and secure link—no password required."}</p></div>
    {errorMsg && <p className="gl-auth-alert gl-auth-alert-error" role="alert">{errorMsg}</p>}
    {successMsg && <div className="gl-auth-alert gl-auth-alert-success" role="status"><p>{successMsg}</p><p className="mt-2 text-xs leading-5 text-white/65">Enter the code below on this computer, or open the link on the device you want to sign in to. Search all mail folders for hello@savvyrilla.tech and use only the newest email.</p>{reference ? <p className="mt-2 text-[11px] text-white/45">Request reference: {reference}</p> : null}</div>}
    <form onSubmit={handleRegister} className="space-y-4">
      <div><label htmlFor="register-email" className="gl-label">Email address</label><input id="register-email" type="email" placeholder="name@example.com" className="gl-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" spellCheck={false} aria-describedby="register-email-help" autoFocus /><p id="register-email-help" className="mt-2 text-xs leading-5 text-white/55">We use this only for secure account access and essential ledger notices.</p></div>
      <button type="submit" disabled={loading || Boolean(successMsg)} className="gl-btn gl-btn-primary gl-btn-md w-full">{loading ? "Sending secure access…" : successMsg ? "Code and link sent" : "Email me a code and link"}</button>
      <p className="gl-auth-legal">By continuing, you agree to the <a href="/terms" className="text-gray-300 underline underline-offset-4">Terms</a> and acknowledge the <a href="/privacy" className="text-gray-300 underline underline-offset-4">Privacy Notice</a>.</p>
    </form>
    {successMsg ? <form onSubmit={verifyCode} className="mt-5 space-y-3 border-t border-white/10 pt-5"><div><label htmlFor="register-code" className="gl-label">Account code</label><input id="register-code" className="gl-input text-center text-xl tracking-[0.28em]" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required aria-describedby="register-code-help" autoFocus /><p id="register-code-help" className="mt-2 text-xs leading-5 text-white/55">Type the 6–8 digit code from the newest Gorilla Ledger email.</p></div><button type="submit" disabled={verifying} className="gl-btn gl-btn-primary gl-btn-md w-full">{verifying ? "Verifying code…" : "Continue with code"}</button></form> : null}
    {successMsg ? <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm"><button type="button" disabled={loading || resendIn > 0} onClick={() => void sendMagicLink()} className="gl-auth-text-link disabled:cursor-not-allowed disabled:opacity-45">{resendIn > 0 ? `Send another email in ${resendIn}s` : "Send another email"}</button><button type="button" onClick={() => { setSuccessMsg(""); setEmail(""); setOtp(""); setReference(""); setResendIn(0); }} className="gl-auth-text-link">Use a different email address</button></div> : null}
    <p className="gl-auth-card-footer">Already have an account? <a href={`/auth/login?next=${encodeURIComponent(next)}`} className="gl-auth-text-link">Sign in</a></p>
  </div>;
}
