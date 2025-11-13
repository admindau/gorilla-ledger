"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Verifying your link…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-gray-800 rounded-lg p-6 bg-black/60">
        <h1 className="text-2xl font-semibold mb-1 text-center">
          Set a new password
        </h1>
        <p className="text-gray-400 text-xs mb-6 text-center">
          Choose a new password for your Gorilla Ledger account.
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

        {hasSession ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block mb-1 text-xs text-gray-400">
                New password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block mb-1 text-xs text-gray-400">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-white text-black py-2 rounded font-semibold text-sm hover:bg-gray-200 disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
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
  );
}
