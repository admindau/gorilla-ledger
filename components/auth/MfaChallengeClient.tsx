"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeAppDestination } from "@/lib/auth/navigation";
import {
  factorDisplayName,
  initialFactorSelection,
  type TotpFactorSummary,
  verifiedTotpFactors,
} from "@/lib/auth/mfa";

const LEGACY_STORAGE_KEY = "gl_mfa_ctx_v1";
const LAST_SECURITY_CHECK_AT_KEY = "gl_last_security_check_at_v1";

function isSixDigitCode(value: string) {
  return /^\d{6}$/.test(value.replace(/\s+/g, ""));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

function recordSuccessfulSecurityCheck() {
  try {
    localStorage.setItem(LAST_SECURITY_CHECK_AT_KEY, String(Date.now()));
  } catch {
    // Local security-review metadata is best effort only.
  }
}

export default function MfaChallengeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(
    () => sanitizeAppDestination(searchParams.get("next")),
    [searchParams],
  );
  const mode = searchParams.get("mode") === "stepup" ? "stepup" : "login";

  const [factors, setFactors] = useState<TotpFactorSummary[]>([]);
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const selectedFactor = factors.find(
    (factor) => factor.id === selectedFactorId,
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setBooting(true);
      setErrorMsg("");

      try {
        // Old releases stored a factor-bound challenge here. Never reuse it:
        // challenges are now created for the factor the user explicitly selects.
        sessionStorage.removeItem(LEGACY_STORAGE_KEY);

        const {
          data: { session },
          error: sessionError,
        } = await supabaseBrowserClient.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          setErrorMsg("Your session has expired. Please log in again.");
          return;
        }

        const { data, error } =
          await supabaseBrowserClient.auth.mfa.listFactors();
        if (error) throw error;

        const verified = verifiedTotpFactors(data?.totp ?? []);
        if (verified.length === 0) {
          setErrorMsg(
            "No authenticator is enrolled for this account. Enable MFA under Security.",
          );
          return;
        }

        if (!cancelled) {
          setFactors(verified);
          // A single factor needs no extra choice. Multiple factors must be
          // selected explicitly so a code is never checked against the wrong secret.
          setSelectedFactorId(initialFactorSelection(verified));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMsg(
            getErrorMessage(error, "Unable to prepare MFA verification."),
          );
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectFactor(factorId: string | null) {
    setSelectedFactorId(factorId);
    setCode("");
    setErrorMsg("");
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setErrorMsg("");

    if (!selectedFactorId) {
      setErrorMsg("Choose the authenticator that generated your code.");
      return;
    }

    const trimmed = code.replace(/\s+/g, "");
    if (!isSixDigitCode(trimmed)) {
      setErrorMsg("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } =
        await supabaseBrowserClient.auth.mfa.challengeAndVerify({
          factorId: selectedFactorId,
          code: trimmed,
        });

      if (error || !data) {
        const factorName = factorDisplayName(
          selectedFactor ?? { id: selectedFactorId, status: "verified" },
          Math.max(
            0,
            factors.findIndex((factor) => factor.id === selectedFactorId),
          ),
        );
        setErrorMsg(
          `That code was not accepted for ${factorName}. Make sure you selected the right authenticator and that automatic date and time are enabled, then try again.`,
        );
        return;
      }

      recordSuccessfulSecurityCheck();

      router.replace(next);
    } catch (error: unknown) {
      setErrorMsg(
        getErrorMessage(
          error,
          "Verification failed. Check the selected authenticator and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (mode === "stepup") {
      router.replace("/about");
      return;
    }

    // Password sign-in has already created an AAL1 session. End it so “Back to
    // login” can actually show the login form and allow a different account.
    await supabaseBrowserClient.auth.signOut();
    router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="gl-card w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold mb-1 text-center">
          Two-factor verification
        </h1>
        <p className="text-gray-400 text-xs mb-6 text-center">
          {factors.length > 1
            ? "Choose an authenticator, then enter its 6-digit code."
            : "Enter the 6-digit code from your authenticator app."}
        </p>

        {errorMsg && (
          <p
            className="mb-4 text-xs text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-950/30"
            role="alert"
          >
            {errorMsg}
          </p>
        )}

        {booting ? (
          <div className="text-xs text-gray-400 text-center">
            Preparing verification…
          </div>
        ) : factors.length > 0 ? (
          <>
            {!selectedFactor ? (
              <div className="space-y-2" aria-label="Choose an authenticator">
                {factors.map((factor, index) => (
                  <button
                    key={factor.id}
                    type="button"
                    onClick={() => selectFactor(factor.id)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white transition hover:border-white/30 hover:bg-white/[0.06]"
                  >
                    <span className="block font-semibold">
                      {factorDisplayName(factor, index)}
                    </span>
                    <span className="mt-1 block text-xs text-gray-400">
                      Authenticator app
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4 text-sm">
                {factors.length > 1 && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                      Using
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      {factorDisplayName(
                        selectedFactor,
                        factors.findIndex(
                          (factor) => factor.id === selectedFactor.id,
                        ),
                      )}
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="mfa-code" className="block mb-1 text-xs text-gray-400">
                    6-digit code
                  </label>
                  <input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="gl-input tracking-widest text-center"
                    placeholder="123456"
                    maxLength={8}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="gl-btn gl-btn-primary gl-btn-md w-full mt-2"
                >
                  {loading ? "Verifying…" : "Verify"}
                </button>

                {factors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => selectFactor(null)}
                    disabled={loading}
                    className="gl-btn gl-btn-secondary gl-btn-md w-full"
                  >
                    Use another authenticator
                  </button>
                )}
              </form>
            )}
          </>
        ) : null}

        <div className="mt-4 text-xs text-gray-400 text-center">
          <button
            type="button"
            onClick={handleCancel}
            className="text-white underline"
          >
            {mode === "stepup" ? "Return to public site" : "Back to login"}
          </button>
        </div>
      </div>
    </div>
  );
}
