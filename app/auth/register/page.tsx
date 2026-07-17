"use client";

import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    // Always send confirmation links back to our PKCE confirmation route.
    // This must be allowed in Supabase Auth "Redirect URLs".
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const emailRedirectTo = `${origin}/auth/confirm?next=${encodeURIComponent("/dashboard")}`;

    const { error } = await supabaseBrowserClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
      return;
    }

    // ✅ Fire-and-forget welcome email (don’t block the UX)
    fetch("/auth/send-welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch((err) => {
      console.error("send-welcome failed", err);
    });

    setLoading(false);

    // Better UX: tell the user to confirm their email.
    setSuccessMsg("Account created. Please check your email to confirm your account.");

    // Optionally still redirect them to login after a short moment.
    // If you prefer immediate redirect, keep router.push("/auth/login") only.
    setTimeout(() => {
      router.push("/auth/login");
    }, 1200);
  }

  return (
    <PublicAuthShell>
    <div className="flex w-full items-center justify-center px-4 text-white">
      <div className="gl-auth-card gl-card w-full max-w-md">
        <div className="gl-auth-card-heading">
          <p className="gl-auth-eyebrow">Your ledger starts here</p>
          <h1>Create your account</h1>
          <p>Build a clearer view of your money in a few minutes.</p>
        </div>

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
            />
          </div>

          <div>
            <label htmlFor="register-password" className="gl-label">Password</label>
            <input
              id="register-password"
              type="password"
              placeholder="At least 6 characters"
              className="gl-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              aria-describedby="register-password-hint"
            />
            <p id="register-password-hint" className="gl-field-hint">Use at least 6 characters.</p>
          </div>

          {errorMsg && <p className="gl-auth-alert gl-auth-alert-error" role="alert">{errorMsg}</p>}
          {successMsg && <p className="gl-auth-alert gl-auth-alert-success" role="status">{successMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="gl-btn gl-btn-primary gl-btn-md w-full"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="gl-auth-legal">
            By creating an account, you agree to the <a href="/terms" className="text-gray-300 underline underline-offset-4">Terms</a> and acknowledge the <a href="/privacy" className="text-gray-300 underline underline-offset-4">Privacy Notice</a>.
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
