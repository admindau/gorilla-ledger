"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

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
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://gl.savvyrilla.tech";

      const { error } =
        await supabaseBrowserClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/auth/update-password`,
        });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(
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
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-gray-800 rounded-lg p-6 bg-black/60">
        <h1 className="text-2xl font-semibold mb-1 text-center">
          Reset your password
        </h1>
        <p className="text-gray-400 text-xs mb-6 text-center">
          Enter the email associated with your Gorilla Ledger account.
          We&apos;ll send you a link to create a new password.
        </p>

        {errorMsg && (
          <p className="mb-4 text-xs text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-950/30">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="mb-4 text-xs text-emerald-400 border border-emerald-500/40 rounded px-3 py-2 bg-emerald-950/30">
            {successMsg}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block mb-1 text-xs text-gray-400">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-white text-black py-2 rounded font-semibold text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <div className="mt-4 text-xs text-gray-400 text-center">
          Remembered it?{" "}
          <button
            type="button"
            onClick={goBackToLogin}
            className="text-white underline"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
