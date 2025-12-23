"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type EnrollState =
  | { status: "idle" }
  | {
      status: "enrolling";
      factorId: string;
      qr: string;
      secret?: string;
      friendlyName: string;
    }
  | { status: "enabled" }
  | { status: "error"; message: string };

const LAST_SECURITY_CHECK_AT_KEY = "gl_last_security_check_at_v1";

function daysAgoFromMs(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function SecuritySettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [otp, setOtp] = useState("");

  const [verifiedTotpCount, setVerifiedTotpCount] = useState(0);
  const [primaryFactorId, setPrimaryFactorId] = useState<string | null>(null);

  const [enroll, setEnroll] = useState<EnrollState>({ status: "idle" });

  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);

  const hasMfa = verifiedTotpCount > 0;
  const hasBackupFactor = verifiedTotpCount >= 2;

  const qrSrc = useMemo(() => {
    if (enroll.status !== "enrolling") return null;
    const qr = enroll.qr;
    if (qr.startsWith("data:image")) return qr;
    return `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`;
  }, [enroll]);

  useEffect(() => {
    // Read last security check from localStorage
    try {
      const raw = localStorage.getItem(LAST_SECURITY_CHECK_AT_KEY);
      const val = raw ? Number(raw) : 0;
      setLastCheckAt(val > 0 ? val : null);
    } catch {
      setLastCheckAt(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabaseBrowserClient.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login?next=/settings/security");
        return;
      }

      const { data: factorsData, error } =
        await supabaseBrowserClient.auth.mfa.listFactors();

      if (cancelled) return;

      if (error) {
        setErrorMsg(error.message ?? "Unable to load MFA status.");
        return;
      }

      const verified =
        factorsData?.totp?.filter((f) => f.status === "verified") ?? [];
      setVerifiedTotpCount(verified.length);
      setPrimaryFactorId(verified[0]?.id ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function bumpLastSecurityCheck() {
    const now = Date.now();
    try {
      localStorage.setItem(LAST_SECURITY_CHECK_AT_KEY, String(now));
    } catch {
      // ignore
    }
    setLastCheckAt(now);
  }

  async function startEnroll(friendlyName: string) {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { data, error } = await supabaseBrowserClient.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });

      if (error || !data) {
        setEnroll({
          status: "error",
          message: error?.message ?? "Failed to enroll MFA.",
        });
        return;
      }

      const qr = (data.totp as any)?.qr_code ?? "";
      const secret = (data.totp as any)?.secret;

      setEnroll({
        status: "enrolling",
        factorId: data.id,
        qr,
        secret,
        friendlyName,
      });
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnroll(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (enroll.status !== "enrolling") return;

    const trimmed = otp.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setErrorMsg("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    try {
      const { data: chData, error: chErr } =
        await supabaseBrowserClient.auth.mfa.challenge({
          factorId: enroll.factorId,
        });

      if (chErr || !chData) {
        setErrorMsg(chErr?.message ?? "Failed to create challenge.");
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

      bumpLastSecurityCheck();

      // Refresh factor list
      const { data: factorsData } =
        await supabaseBrowserClient.auth.mfa.listFactors();
      const verified =
        factorsData?.totp?.filter((f) => f.status === "verified") ?? [];

      setVerifiedTotpCount(verified.length);
      setPrimaryFactorId(verified[0]?.id ?? null);

      setSuccessMsg(
        verified.length >= 2
          ? "Backup authenticator added successfully."
          : "MFA enabled successfully."
      );

      setEnroll({ status: "enabled" });
      setOtp("");
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

      bumpLastSecurityCheck();

      setSuccessMsg("MFA disabled.");
      setVerifiedTotpCount(0);
      setPrimaryFactorId(null);
      setEnroll({ status: "idle" });
    } finally {
      setLoading(false);
    }
  }

  const lastCheckLabel =
    lastCheckAt && lastCheckAt > 0
      ? `${daysAgoFromMs(lastCheckAt)} day(s) ago`
      : "Not recorded";

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-xl border border-gray-800 rounded-lg p-6 bg-black/60">
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

        <div className="mt-6 border border-gray-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                Multi-factor authentication (TOTP)
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Use Google Authenticator, Microsoft Authenticator, Authy, or
                1Password.
              </p>

              <div className="mt-3 text-xs">
                <div className="text-gray-400">Status</div>
                <div className={hasMfa ? "text-emerald-400" : "text-gray-300"}>
                  {hasMfa ? "Enabled" : "Not enabled"}
                </div>
              </div>

              {hasMfa && (
                <div className="mt-3 text-xs">
                  <div className="text-gray-400">Backup factor</div>
                  <div
                    className={
                      hasBackupFactor ? "text-emerald-400" : "text-amber-300"
                    }
                  >
                    {hasBackupFactor ? "Configured" : "Not configured"}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {hasMfa ? (
                <>
                  {!hasBackupFactor && (
                    <button
                      type="button"
                      onClick={() => startEnroll("Backup Authenticator")}
                      disabled={loading}
                      className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
                    >
                      Add backup factor
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={disableMfa}
                    disabled={loading}
                    className="bg-black border border-white/20 text-white px-4 py-2 rounded text-sm hover:bg-white hover:text-black transition disabled:opacity-60"
                  >
                    Disable
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => startEnroll("Authenticator")}
                  disabled={loading}
                  className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
                >
                  Enable
                </button>
              )}
            </div>
          </div>

          {/* Recovery guidance (Supabase has no recovery codes) */}
          {hasMfa && !hasBackupFactor && enroll.status !== "enrolling" && (
            <div className="mt-5 text-xs border border-amber-500/40 bg-amber-950/20 rounded px-3 py-2 text-amber-200">
              Supabase does not provide recovery codes. For account recovery,
              enroll a{" "}
              <span className="text-white">backup authenticator factor</span> on
              a different device or app.
            </div>
          )}

          {enroll.status === "enrolling" ? (
            <div className="mt-6 border-t border-gray-800 pt-6">
              <h3 className="font-semibold">
                {enroll.friendlyName === "Backup Authenticator"
                  ? "Add a backup authenticator"
                  : "Set up your authenticator"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Scan the QR code, then enter the 6-digit code to confirm.
              </p>

              {qrSrc ? (
                <div className="mt-4 flex items-center justify-center bg-white rounded-lg p-3">
                  <img
                    src={qrSrc}
                    alt="MFA QR Code"
                    className="max-w-[220px] w-full h-auto"
                  />
                </div>
              ) : null}

              {enroll.secret ? (
                <p className="text-xs text-gray-400 mt-4">
                  If you can’t scan, enter this secret manually:{" "}
                  <span className="text-white break-all">{enroll.secret}</span>
                </p>
              ) : null}

              <form onSubmit={confirmEnroll} className="mt-5 space-y-3">
                <div>
                  <label className="block mb-1 text-xs text-gray-400">
                    6-digit code
                  </label>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white tracking-widest text-center"
                    placeholder="123456"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black py-2 rounded font-semibold text-sm hover:bg-gray-200 disabled:opacity-60"
                >
                  {loading ? "Confirming..." : "Confirm"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
