"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type MfaCtx = {
  factorId: string;
  challengeId: string;
  next: string;
};

const STORAGE_KEY = "gl_mfa_ctx_v1";

export default function MfaClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") ?? "/dashboard", [sp]);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [ctx, setCtx] = useState<MfaCtx | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setErrorMsg("MFA session not found. Please log in again.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as MfaCtx;
      setCtx({ ...parsed, next });
    } catch {
      setErrorMsg("MFA session invalid. Please log in again.");
    }
  }, [next]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!ctx) return;

    const trimmed = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setErrorMsg("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabaseBrowserClient.auth.mfa.verify({
        factorId: ctx.factorId,
        challengeId: ctx.challengeId,
        code: trimmed,
      });

      if (error || !data) {
        setErrorMsg(error?.message ?? "Verification failed. Try again.");
        return;
      }

      sessionStorage.removeItem(STORAGE_KEY);
      router.replace(ctx.next || "/dashboard");
    } finally {
      setLoading(false);
    }
  }

  function backToLogin() {
    sessionStorage.removeItem(STORAGE_KEY);
    router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-gray-800 rounded-lg p-6 bg-black/60">
        <h1 className="text-2xl font-semibold mb-1 text-center">
          Two-factor verification
        </h1>
        <p className="text-gray-400 text-xs mb-6 text-center">
          Enter the 6-digit code from your authenticator app.
        </p>

        {errorMsg && (
          <p className="mb-4 text-xs text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-950/30">
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleVerify} className="space-y-4 text-sm">
          <div>
            <label className="block mb-1 text-xs text-gray-400">Code</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white tracking-widest text-center"
              placeholder="123456"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !ctx}
            className="w-full mt-2 bg-white text-black py-2 rounded font-semibold text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <div className="mt-4 text-xs text-gray-400 text-center">
          <button type="button" onClick={backToLogin} className="text-white underline">
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
