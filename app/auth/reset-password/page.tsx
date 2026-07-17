"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";

export default function ResetPasswordRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/auth/send-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok && body?.error) {
        setErrorMsg(body.error || "Something went wrong.");
      } else {
        setSuccessMsg(
          body?.message ??
            "If this email exists in our system, a reset link has been sent."
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message || "Something went wrong.");
      } else {
        setErrorMsg("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  function goBackToLogin() {
    router.push("/auth/login");
  }

  return (
    <PublicAuthShell>
    <div className="flex w-full items-center justify-center px-4 text-white">
      <div className="gl-auth-card gl-card w-full max-w-md">
        <div className="gl-auth-card-heading">
          <p className="gl-auth-eyebrow">Account recovery</p>
          <h1>Reset your password</h1>
          <p>Enter your account email and we&apos;ll send a secure reset link.</p>
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
            <label htmlFor="reset-email" className="gl-label">Email address</label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="gl-input"
              placeholder="name@company.com"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="gl-btn gl-btn-primary gl-btn-md w-full mt-2"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <div className="gl-auth-card-footer">
          Remembered it?{" "}
          <button
            type="button"
            onClick={goBackToLogin}
            className="gl-auth-text-link"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
    </PublicAuthShell>
  );
}
