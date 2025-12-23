"use client";

/* =============================================================================
   Gorilla Ledger™ — Settings / Security
   - MFA (TOTP) management
   - Backup factor enrollment
   - “Last security check” tracking
   ============================================================================= */

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

/* =============================================================================
   Constants & Helpers
   ============================================================================= */

const LAST_SECURITY_CHECK_AT_KEY = "gl_last_security_check_at_v1";

function daysAgoFromMs(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isSixDigitCode(value: string) {
  const trimmed = value.replace(/\s+/g, "");
  return /^\d{6}$/.test(trimmed);
}

/* =============================================================================
   Types
   ============================================================================= */

type EnrollState =
  | { status: "idle" }
  | { status: "enrolling"; qr: string; secret: string; factorId: string }
  | { status: "enabled" };

type TotpFactor = {
  id: string;
  status: string;
  friendly_name?: string | null;
};

/* =============================================================================
   Page
   ============================================================================= */

export default function SecuritySettingsPage() {
  // ---------------------------------------------------------------------------
  // UI State
  // ---------------------------------------------------------------------------
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [enroll, setEnroll] = useState<EnrollState>({ status: "idle" });
  const [otp, setOtp] = useState("");

  // Factors
  const [verifiedTotp, setVerifiedTotp] = useState<TotpFactor[]>([]);
  const [primaryFactorId, setPrimaryFactorId] = useState<string | null>(null);

  // Last security check
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Derived labels
  // ---------------------------------------------------------------------------
  const mfaEnabled = verifiedTotp.length >= 1;
  const backupConfigured = verifiedTotp.length >= 2;

  const lastCheckLabel = useMemo(() => {
    if (!lastCheckAt || lastCheckAt <= 0) return "Not recorded";
    return `${daysAgoFromMs(lastCheckAt)} day(s) ago`;
  }, [lastCheckAt]);

  // ---------------------------------------------------------------------------
  // Data loaders
  // ---------------------------------------------------------------------------
  async function refreshFactors() {
    const { data, error } = await supabaseBrowserClient.auth.mfa.listFactors();
    if (error) throw error;

    const totp = (data?.totp ?? []) as TotpFactor[];
    const verified = totp.filter((f) => f.status === "verified");
    setVerifiedTotp(verified);

    // Choose a “primary” deterministically:
    // - Prefer the first verified factor returned.
    // - (Optional future: persist a preferred factorId in DB or user metadata.)
    setPrimaryFactorId(verified[0]?.id ?? null);
  }

  function bumpLastSecurityCheck() {
    try {
      const now = Date.now();
      localStorage.setItem(LAST_SECURITY_CHECK_AT_KEY, String(now));
      setLastCheckAt(now);
    } catch {
      // ignore
    }
  }

  function loadLastCheck() {
    try {
      const raw = localStorage.getItem(LAST_SECURITY_CHECK_AT_KEY);
      if (!raw) return;
      const ms = Number(raw);
      if (!Number.isFinite(ms)) return;
      setLastCheckAt(ms);
    } catch {
      // ignore
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setBooting(true);
      setErrorMsg("");
      setSuccessMsg("");

      loadLastCheck();

      try {
        await refreshFactors();
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message ?? "Unable to load security settings.");
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

  // ---------------------------------------------------------------------------
  // Actions: Enroll / Verify / Disable
  // ---------------------------------------------------------------------------
  async function startEnroll() {
    setErrorMsg("");
    setSuccessMsg("");
    setOtp("");
    setLoading(true);

    try {
      const friendlyName = mfaEnabled
        ? `Backup Authenticator (${new Date().toISOString().slice(0, 10)})`
        : `Authenticator (${new Date().toISOString().slice(0, 10)})`;

      const { data, error } = await supabaseBrowserClient.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });

      if (error || !data) {
        setErrorMsg(error?.message ?? "Failed to start MFA enrollment.");
        return;
      }

      // `data` includes: id, secret, qr_code (svg)
      setEnroll({
        status: "enrolling",
        factorId: data.id,
        secret: data.totp.secret,
        qr: data.totp.qr_code,
      });
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (enroll.status !== "enrolling") return;

    const trimmed = otp.replace(/\s+/g, "");
    if (!isSixDigitCode(trimmed)) {
      setErrorMsg("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    try {
      const { data: chData, error: chErr } =
        await supabaseBrowserClient.auth.mfa.challenge({
          factorId: enroll.factorId,
        });

      if (chErr || !chData?.id) {
        setErrorMsg(chErr?.message ?? "Failed to create a challenge.");
        return;
      }

      const { error: vErr } = await supabaseBrowserClient.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: chData.id,
        code: trimmed,
      });

      if (vErr) {
        setErrorMsg(vErr.message ?? "Verification failed.");
        return;
      }

      await refreshFactors();
      bumpLastSecurityCheck();

      const nowVerified = verifiedTotp.length + 1; // approximate; refreshFactors will set true state
      setSuccessMsg(
        nowVerified >= 2
          ? "Backup authenticator added successfully."
          : "Multi-factor authentication enabled successfully."
      );

      setEnroll({ status: "enabled" });
      setOtp("");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function disableMfa() {
    if (!primaryFactorId) return;

    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { error } = await supabaseBrowserClient.auth.mfa.unenroll({
        factorId: primaryFactorId,
      });

      if (error) {
        setErrorMsg(error.message ?? "Failed to disable MFA.");
        return;
      }

      await refreshFactors();
      bumpLastSecurityCheck();

      setSuccessMsg("Multi-factor authentication disabled.");
      setEnroll({ status: "idle" });
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-xl border border-gray-800 rounded-lg p-6 bg-black/60">
        {/* ========================= Header ========================= */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Security</h1>
            <p className="text-gray-400 text-xs">
              MFA status and account protection controls.
            </p>
          </div>

          <div className="text-right text-xs">
            <div className="text-gray-400">Last security check</div>
            <div className="text-white">{lastCheckLabel}</div>
          </div>
        </div>

        {/* ========================= Alerts ========================= */}
        {errorMsg && (
          <p className="mt-4 text-xs text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-950/30">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="mt-4 text-xs text-emerald-400 border border-emerald-500/40 rounded px-3 py-2 bg-emerald-950/30">
            {successMsg}
          </p>
        )}

        {/* ========================= MFA Card ========================= */}
        <div className="mt-6 border border-gray-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Multi-factor authentication (TOTP)</h2>
              <p className="text-xs text-gray-400 mt-1">
                Use Google Authenticator, Microsoft Authenticator, Authy, or 1Password.
              </p>

              <div className="mt-3 space-y-1 text-xs">
                <div className="text-gray-400">
                  Status:{" "}
                  <span className={mfaEnabled ? "text-emerald-400" : "text-gray-300"}>
                    {mfaEnabled ? "Enabled" : "Not enabled"}
                  </span>
                </div>

                <div className="text-gray-400">
                  Backup factor:{" "}
                  <span className={backupConfigured ? "text-emerald-400" : "text-yellow-300"}>
                    {backupConfigured ? "Configured" : "Not configured"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {mfaEnabled ? (
                <>
                  {!backupConfigured && (
                    <button
                      type="button"
                      onClick={startEnroll}
                      disabled={loading || booting}
                      className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
                    >
                      Add backup factor
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={disableMfa}
                    disabled={loading || booting}
                    className="bg-black border border-white/20 text-white px-4 py-2 rounded text-sm hover:bg-white hover:text-black transition disabled:opacity-60"
                  >
                    Disable
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEnroll}
                  disabled={loading || booting}
                  className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
                >
                  Enable
                </button>
              )}
            </div>
          </div>

          {/* ========================= Brand Warning (No Supabase mention) ========================= */}
          {!backupConfigured && (
            <div className="mt-4 text-xs text-yellow-200 border border-yellow-500/40 rounded px-3 py-2 bg-yellow-950/20">
              Savvy Gorilla™ does not provide recovery codes. For account recovery, enroll a backup
              authenticator factor on a different device or app.
            </div>
          )}

          {/* ========================= Enrollment UI ========================= */}
          {enroll.status === "enrolling" && (
            <div className="mt-6 border-t border-gray-800 pt-5">
              <h3 className="text-sm font-semibold">Complete enrollment</h3>
              <p className="text-xs text-gray-400 mt-1">
                Scan the QR code in your authenticator app, then enter the 6-digit code.
              </p>

              <div className="mt-4 flex flex-col gap-4">
                <div className="border border-gray-800 rounded p-3 bg-black/40">
                  <div
                    className="w-full overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: enroll.qr }}
                  />
                </div>

                <form onSubmit={verifyEnroll} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      6-digit code
                    </label>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      inputMode="numeric"
                      placeholder="123456"
                      className="w-full bg-black border border-gray-800 rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
                  >
                    Verify & enable
                  </button>
                </form>

                <div className="text-[11px] text-gray-400">
                  Secret (store securely if needed):{" "}
                  <span className="text-gray-200">{enroll.secret}</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================= Boot state hint ========================= */}
          {booting && (
            <p className="mt-4 text-xs text-gray-400">Loading security settings…</p>
          )}
        </div>
      </div>
    </div>
  );
}
