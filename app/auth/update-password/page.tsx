"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (session) {
        setHasSession(true);
      } else {
        setErrorMsg(
          "Recovery link is invalid or has expired. Please request a new reset link."
        );
      }
      setCheckingSession(false);
    }

    checkSession();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (password.length < 6) {
      setErrorMsg("Password should be at least 6 characters long.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabaseBrowserClient.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg("Your password has been updated. You can now log in.");
    // optional: sign out recovery session after a short delay
    setTimeout(async () => {
      await supabaseBrowserClient.auth.signOut();
      router.replace("/auth/login");
    }, 2000);
  }

  if (checkingSession) {
    return (
      <PublicAuthShell>
        <p className="text-sm text-gray-400" role="status">
          Verifying your secure link…
        </p>
      </PublicAuthShell>
    );
  }

  return (
    <PublicAuthShell>
      <div className="flex w-full items-center justify-center px-4 text-white">
        <div className="gl-auth-card gl-card w-full max-w-md">
          <div className="gl-auth-card-heading">
            <p className="gl-auth-eyebrow">Account recovery</p>
            <h1>Set a new password</h1>
            <p>Choose a new password for your Gorilla Ledger account.</p>
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

        {hasSession ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label htmlFor="new-password" className="gl-label">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gl-input"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-describedby="new-password-hint"
              />
              <p id="new-password-hint" className="gl-field-hint">
                Use at least 6 characters.
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="gl-label">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="gl-input"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="gl-btn gl-btn-primary gl-btn-md w-full mt-2"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : (
          <div className="text-xs text-gray-400 text-center mt-4">
            <button
              type="button"
              onClick={() => router.replace("/auth/reset-password")}
              className="text-white underline"
            >
              Request a new reset link
            </button>
          </div>
        )}
        </div>
      </div>
    </PublicAuthShell>
  );
}
