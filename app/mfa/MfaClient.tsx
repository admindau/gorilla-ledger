"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type MfaCtx = {
  factorId: string;
  challengeId: string;
  next: string;
  mode?: "login" | "stepup";
};

const STORAGE_KEY = "gl_mfa_ctx_v1";
const LAST_SECURITY_CHECK_AT_KEY = "gl_last_security_check_at_v1";

function isSixDigitCode(value: string) {
  const trimmed = value.replace(/\s+/g, "");
  return /^\d{6}$/.test(trimmed);
}

export default function MfaClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") ?? "/dashboard", [sp]);
  const mode = useMemo(
    () => (sp.get("mode") === "stepup" ? "stepup" : "login"),
    [sp]
  );

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [ctx, setCtx] = useState<MfaCtx | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setBooting(true);
      setErrorMsg("");

      // 1) Login flow: ctx pre-seeded in sessionStorage
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as MfaCtx;
          const hydrated: MfaCtx = { ...parsed, next, mode };
          if (!cancelled) setCtx(hydrated);
          setBooting(false);
          return;
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }

      // 2) Step-up flow: create a challenge dynamically for a verified TOTP factor
      if (mode === "stepup") {
        try {
          const {
            data: { session },
            error: sessionErr,
          } = await supabaseBrowserClient.auth.getSession();

          if (sessionErr) throw sessionErr;
          if (!session) {
            if (!cancelled) {
              setErrorMsg("Your session has expired. Please log in again.");
              setBooting(false);
            }
            return;
          }

          const { data: factorsData, error: factorsErr } =
            await supabaseBrowserClient.auth.mfa.listFactors();

          if (factorsErr) throw factorsErr;

          const totpFactor =
            factorsData?.totp?.find((f) => f.status === "verified") ?? null;

          if (!totpFactor) {
            if (!cancelled) {
              setErrorMsg(
                "No authenticator factor is enrolled for this account. Enable MFA first under Security."
              );
              setBooting(false);
            }
            return;
          }

          const { data: challengeData, error: challengeErr } =
            await supabaseBrowserClient.auth.mfa.challenge({
              factorId: totpFactor.id,
            });

          if (challengeErr) throw challengeErr;
          if (!challengeData?.id) {
            if (!cancelled) {
              setErrorMsg("Unable to start MFA challenge. Please try again.");
              setBooting(false);
            }
            return;
          }

          const newCtx: MfaCtx = {
            factorId: totpFactor.id,
            challengeId: challengeData.id,
            next,
            mode: "stepup",
          };

          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newCtx));
          if (!cancelled) setCtx(newCtx);
        } catch (e: any) {
          if (!cancelled) {
            setErrorMsg(e?.message ?? "Unable to start step-up MFA. Try again.");
          }
        } finally {
          if (!cancelled) setBooting(false);
        }
        return;
      }

      // 3) No ctx and not stepup
      if (!cancelled) {
        setErrorMsg("MFA session not found. Please log in again.");
        setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [next, mode]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!ctx) return;

    const trimmed = code.replace(/\s+/g, "");
    if (!isSixDigitCode(trimmed)) {
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

      // Record “last security check” on successful OTP verify
      try {
        localStorage.setItem(LAST_SECURITY_CHECK_AT_KEY, String(Date.now()));
      } catch {
        // ignore
      }

      sessionStorage.removeItem(STORAGE_KEY);
      router.replace(ctx.next || "/dashboard");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    sessionStorage.removeItem(STORAGE_KEY);

    if (mode === "stepup") {
      router.replace(next);
      return;
    }

    router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-gray-800 rounded-lg p-6 bg-black/60">
        <h1 className="text-2xl font-semibold mb-1 text-center">
          Two-factor verification
        </h1>
        <p className="text-gray-400 text-xs mb-6 text-center">
          {mode === "stepup"
            ? "Confirm your code to continue."
            : "Enter the 6-digit code from your authenticator app."}
        </p>

        {errorMsg && (
          <p className="mb-4 text-xs text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-950/30">
            {errorMsg}
          </p>
        )}

        {booting ? (
          <div className="text-xs text-gray-400 text-center">
            Preparing verification…
          </div>
        ) : (
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
        )}

        <div className="mt-4 text-xs text-gray-400 text-center">
          <button
            type="button"
            onClick={handleCancel}
            className="text-white underline"
          >
            {mode === "stepup" ? "Cancel" : "Back to login"}
          </button>
        </div>
      </div>
    </div>
  );
}
