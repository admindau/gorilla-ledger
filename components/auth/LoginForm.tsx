"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

const MFA_STORAGE_KEY = "gl_mfa_ctx_v1";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const { error } = await supabaseBrowserClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const nextUrl = next || "/dashboard";

      /**
       * MFA (TOTP) handling:
       * If user has a verified TOTP factor, start an MFA challenge and redirect to /auth/mfa.
       */
      const { data: factorsData, error: factorsErr } =
        await supabaseBrowserClient.auth.mfa.listFactors();

      if (factorsErr) {
        setErrorMsg(
          "We could not verify your account's MFA requirements. Please try again."
        );
        return;
      }

      const verifiedTotp = factorsData?.totp?.find(
        (f) => f.status === "verified"
      );

      if (verifiedTotp) {
        const { data: challengeData, error: chErr } =
          await supabaseBrowserClient.auth.mfa.challenge({
            factorId: verifiedTotp.id,
          });

        if (chErr || !challengeData) {
          setErrorMsg(chErr?.message ?? "Failed to start MFA challenge.");
          return;
        }

        sessionStorage.setItem(
          MFA_STORAGE_KEY,
          JSON.stringify({
            factorId: verifiedTotp.id,
            challengeId: challengeData.id,
            next: nextUrl,
          })
        );

        router.replace(`/auth/mfa?next=${encodeURIComponent(nextUrl)}`);
        return;
      }

      // No MFA enabled -> proceed normally
      router.push(nextUrl);
    } finally {
      setLoading(false);
    }
  }

  function goToRegister() {
    router.push("/auth/register");
  }

  function goToResetPassword() {
    router.push("/auth/reset-password");
  }

  return (
    <div className="gl-auth-card gl-card w-full max-w-md">
      <div className="gl-auth-card-heading">
        <p className="gl-auth-eyebrow">Welcome back</p>
        <h1>Sign in to your ledger</h1>
        <p>Your financial picture is ready when you are.</p>
      </div>

      {errorMsg && (
        <p className="gl-auth-alert gl-auth-alert-error" role="alert">
          {errorMsg}
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
          />
        </div>

        <div>
          <label htmlFor="login-password" className="gl-label">Password</label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="gl-input"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <div className="gl-auth-form-meta">
          <button
            type="button"
            onClick={goToResetPassword}
            className="gl-auth-text-link"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="gl-btn gl-btn-primary gl-btn-md w-full mt-2"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="gl-auth-card-footer">
        New to Gorilla Ledger?{" "}
        <button
          type="button"
          onClick={goToRegister}
          className="gl-auth-text-link"
        >
          Create an account
        </button>
      </div>
    </div>
  );
}
