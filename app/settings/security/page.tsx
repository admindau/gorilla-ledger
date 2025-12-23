"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type EnrollState =
  | { status: "idle" }
  | { status: "enrolling"; factorId: string; qr: string; secret?: string }
  | { status: "enabled" }
  | { status: "error"; message: string };

export default function SecuritySettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [otp, setOtp] = useState("");

  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<EnrollState>({ status: "idle" });
  const [hasTotp, setHasTotp] = useState(false);

  const qrSrc = useMemo(() => {
    if (enroll.status !== "enrolling") return null;

    const qr = enroll.qr;

    if (qr.startsWith("data:image")) return qr;
    return `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`;
  }, [enroll]);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowserClient.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login?next=/settings/security");
        return;
      }

      const { data: factorsData } = await supabaseBrowserClient.auth.mfa.listFactors();
      const verified = factorsData?.totp?.filter((f) => f.status === "verified") ?? [];

      setHasTotp(verified.length > 0);
      setFactorId(verified[0]?.id ?? null);
    })();
  }, [router]);

  async function startEnroll() {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { data, error } = await supabaseBrowserClient.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator",
      });

      if (error || !data) {
        setEnroll({ status: "error", message: error?.message ?? "Failed to enroll MFA." });
        return;
      }

      // Supabase returns TOTP payload containing qr_code (often SVG) and secret.
      const qr = (data.totp as any)?.qr_code ?? "";
      const secret = (data.totp as any)?.secret;

      setEnroll({
        status: "enrolling",
        factorId: data.id,
        qr,
        secret,
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
      const { data: chData, error: chErr } = await supabaseBrowserClient.auth.mfa.challenge({
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

      setSuccessMsg("MFA enabled successfully.");
      setEnroll({ status: "enabled" });
      setHasTotp(true);
      setFactorId(enroll.factorId);
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  async function disableMfa() {
    if (!factorId) return;

    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { error } = await supabaseBrowserClient.auth.mfa.unenroll({
        factorId,
      });

      if (error) {
        setErrorMsg(error.message ?? "Failed to disable MFA.");
        return;
      }

      setSuccessMsg("MFA disabled.");
      setHasTotp(false);
      setFactorId(null);
      setEnroll({ status: "idle" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-xl border border-gray-800 rounded-lg p-6 bg-black/60">
        <h1 className="text-2xl font-semibold mb-1">Security</h1>
        <p className="text-gray-400 text-xs mb-6">
          Manage two-factor authentication (Authenticator app).
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

        <div className="border border-gray-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Two-factor authentication (TOTP)</h2>
              <p className="text-xs text-gray-400 mt-1">
                Use Google Authenticator, Microsoft Authenticator, Authy, or 1Password.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Status:{" "}
                <span className={hasTotp ? "text-emerald-400" : "text-gray-300"}>
                  {hasTotp ? "Enabled" : "Not enabled"}
                </span>
              </p>
            </div>

            {hasTotp ? (
              <button
                type="button"
                onClick={disableMfa}
                disabled={loading}
                className="bg-black border border-white/20 text-white px-4 py-2 rounded text-sm hover:bg-white hover:text-black transition disabled:opacity-60"
              >
                Disable
              </button>
            ) : (
              <button
                type="button"
                onClick={startEnroll}
                disabled={loading}
                className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
              >
                Enable
              </button>
            )}
          </div>

          {enroll.status === "enrolling" ? (
            <div className="mt-6 border-t border-gray-800 pt-6">
              <h3 className="font-semibold">Set up your authenticator</h3>
              <p className="text-xs text-gray-400 mt-1">
                Scan the QR code, then enter the 6-digit code to confirm.
              </p>

              {qrSrc ? (
                <div className="mt-4 flex items-center justify-center bg-white rounded-lg p-3">
                  <img src={qrSrc} alt="MFA QR Code" className="max-w-[220px] w-full h-auto" />
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
                  <label className="block mb-1 text-xs text-gray-400">6-digit code</label>
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
                  {loading ? "Confirming..." : "Confirm MFA"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
