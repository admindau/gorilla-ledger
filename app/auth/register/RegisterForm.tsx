"use client";

import { useEffect, useState } from "react";

export function RegisterForm({ next, familyInvite = false }: { next: string; familyInvite?: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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
        ? "Check your email for a secure link, then continue to the shared household ledger."
        : body.message ?? "Check your email to finish creating your account. Your secure link signs you in automatically.");
      setResendIn(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
    } catch { setErrorMsg("We could not send a secure link. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    void sendMagicLink();
  }

  return <div className="gl-auth-card gl-card w-full max-w-md">
    <div className="gl-auth-card-heading"><p className="gl-auth-eyebrow">{familyInvite ? "Create your secure account" : "Your ledger starts here"}</p><h1>{familyInvite ? "Join your family ledger" : "Create your account"}</h1><p>{familyInvite ? "Use the email address that received the invitation. We’ll send a secure sign-in link—no shared password required." : "Enter your email and we’ll send a secure link—no password required."}</p></div>
    {errorMsg && <p className="gl-auth-alert gl-auth-alert-error" role="alert">{errorMsg}</p>}
    {successMsg && <div className="gl-auth-alert gl-auth-alert-success" role="status"><p>{successMsg}</p><p className="mt-2 text-xs leading-5 text-white/65">Look in Focused, Other, Junk, and Deleted Items, or search all folders for hello@savvyrilla.tech. If you requested more than one email, open only the newest link.</p></div>}
    <form onSubmit={handleRegister} className="space-y-4">
      <div><label htmlFor="register-email" className="gl-label">Email address</label><input id="register-email" type="email" placeholder="name@example.com" className="gl-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" spellCheck={false} aria-describedby="register-email-help" autoFocus /><p id="register-email-help" className="mt-2 text-xs leading-5 text-white/55">We use this only for secure account access and essential ledger notices.</p></div>
      <button type="submit" disabled={loading || Boolean(successMsg)} className="gl-btn gl-btn-primary gl-btn-md w-full">{loading ? "Sending secure link…" : successMsg ? "Magic link sent" : "Email me a sign-up link"}</button>
      <p className="gl-auth-legal">By continuing, you agree to the <a href="/terms" className="text-gray-300 underline underline-offset-4">Terms</a> and acknowledge the <a href="/privacy" className="text-gray-300 underline underline-offset-4">Privacy Notice</a>.</p>
    </form>
    {successMsg ? <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm"><button type="button" disabled={loading || resendIn > 0} onClick={() => void sendMagicLink()} className="gl-auth-text-link disabled:cursor-not-allowed disabled:opacity-45">{resendIn > 0 ? `Send another link in ${resendIn}s` : "Send another link"}</button><button type="button" onClick={() => { setSuccessMsg(""); setEmail(""); setResendIn(0); }} className="gl-auth-text-link">Use a different email address</button></div> : null}
    <p className="gl-auth-card-footer">Already have an account? <a href={`/auth/login?next=${encodeURIComponent(next)}`} className="gl-auth-text-link">Sign in</a></p>
  </div>;
}
