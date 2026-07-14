"use client";

/* =============================================================================
   Gorilla Ledger™ — Settings / Security
   - MFA (TOTP) management
   - Backup factor enrollment
   - “Last security check” tracking
   - Top navigation
   ============================================================================= */

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { SecurityCommandCenter } from "@/components/security/SecurityCommandCenter";
import { SecurityMfaPanel } from "@/components/security/SecurityMfaPanel";
import { SecurityRecommendations } from "@/components/security/SecurityRecommendations";

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

function ymd(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function shortToken(len = 6) {
  // client-safe, no dependencies
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(len);
  // crypto exists in modern browsers; fallback if not
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
    return out;
  }
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function looksLikeFriendlyNameExists(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("friendly name") && m.includes("already exists");
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
  const [allTotp, setAllTotp] = useState<TotpFactor[]>([]);
  const [verifiedTotp, setVerifiedTotp] = useState<TotpFactor[]>([]);
  const [primaryFactorId, setPrimaryFactorId] = useState<string | null>(null);

  // Last security check
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);

  // Nav / auth
  const [userEmail, setUserEmail] = useState<string>("");
  const [signingOut, setSigningOut] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived labels
  // ---------------------------------------------------------------------------
  const mfaEnabled = verifiedTotp.length >= 1;
  const backupConfigured = verifiedTotp.length >= 2;

  const lastCheckLabel = useMemo(() => {
    if (!lastCheckAt || lastCheckAt <= 0) return "Not recorded";
    return `${daysAgoFromMs(lastCheckAt)} day(s) ago`;
  }, [lastCheckAt]);

  async function handleLogout() {
    if (signingOut) return;

    const ok = window.confirm(
      "You are about to log out of Gorilla Ledger™. Continue?"
    );
    if (!ok) return;

    setSigningOut(true);
    try {
      await supabaseBrowserClient.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  // ---------------------------------------------------------------------------
  // Data loaders
  // ---------------------------------------------------------------------------
  async function refreshFactors() {
    const { data, error } = await supabaseBrowserClient.auth.mfa.listFactors();
    if (error) throw error;

    const totp = (data?.totp ?? []) as TotpFactor[];
    setAllTotp(totp);

    const verified = totp.filter((f) => f.status === "verified");
    setVerifiedTotp(verified);

    // Choose a “primary” deterministically (first verified)
    setPrimaryFactorId(verified[0]?.id ?? null);

    return totp;
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

  function nextFriendlyName(existing: TotpFactor[], kind: "primary" | "backup") {
    // NOTE: We *always* ensure uniqueness to avoid conflicts with orphaned/unverified factors.
    const base = kind === "backup" ? "Backup Authenticator" : "Authenticator";
    const existingNames = new Set(
      existing
        .map((f) => (f.friendly_name ?? "").trim())
        .filter(Boolean)
    );

    // Preferred format: human-readable + date, with a short unique suffix.
    // Example: "Authenticator (2025-12-24) — K7P2QM"
    // Keeps it professional while preventing collisions.
    let attempt = 0;
    while (attempt < 5) {
      const name = `${base} (${ymd()}) — ${shortToken(6)}`;
      if (!existingNames.has(name)) return name;
      attempt++;
    }

    // Extreme fallback
    return `${base} (${ymd()}) — ${Date.now()}`;
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
        const [{ data: u }] = await Promise.all([
          supabaseBrowserClient.auth.getUser(),
          refreshFactors(),
        ]);

        if (!cancelled) setUserEmail(u?.user?.email ?? "");
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMsg(getErrorMessage(error, "Unable to load security settings."));
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();

    // Keep factors fresh if user just changed them in another tab / Supabase dashboard
    const onFocus = () => {
      refreshFactors().catch(() => void 0);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
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
      // Always refresh first to avoid stale UI decisions
      const current = await refreshFactors();

      const kind: "primary" | "backup" = mfaEnabled ? "backup" : "primary";
      const friendlyName = nextFriendlyName(current, kind);

      const { data, error } = await supabaseBrowserClient.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });

      if (error || !data) {
        // One automatic retry if Supabase complains about friendly-name collision
        if (looksLikeFriendlyNameExists(error?.message ?? "")) {
          const refreshed = await refreshFactors();
          const retryName = nextFriendlyName(refreshed, kind);

          const retry = await supabaseBrowserClient.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: retryName,
          });

          if (retry.error || !retry.data) {
            setErrorMsg(
              retry.error?.message ?? "Failed to start MFA enrollment."
            );
            return;
          }

          setEnroll({
            status: "enrolling",
            factorId: retry.data.id,
            secret: retry.data.totp.secret,
            qr: retry.data.totp.qr_code,
          });
          return;
        }

        setErrorMsg(error?.message ?? "Failed to start MFA enrollment.");
        return;
      }

      setEnroll({
        status: "enrolling",
        factorId: data.id,
        secret: data.totp.secret,
        qr: data.totp.qr_code,
      });
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "Failed to start MFA enrollment."));
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

      setSuccessMsg(
        mfaEnabled
          ? "Backup authenticator added successfully."
          : "Multi-factor authentication enabled successfully."
      );

      setEnroll({ status: "enabled" });
      setOtp("");
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "Verification failed."));
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
    <div className="gl-page-migrated">
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Account Protection"
          title="Security Command Center"
          description="Protect your Gorilla Ledger™ account with multi-factor authentication, recovery readiness, and security best practices."
          action={
            userEmail ? (
              <div className="hidden text-right text-xs text-gray-400 sm:block">
                <div>Signed in as</div>
                <div className="max-w-[220px] truncate text-white">{userEmail}</div>
              </div>
            ) : null
          }
        />

        {errorMsg && (
          <p className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {errorMsg}
          </p>
        )}

        {successMsg && (
          <p className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
            {successMsg}
          </p>
        )}

        <SecurityCommandCenter
          mfaEnabled={mfaEnabled}
          backupConfigured={backupConfigured}
          factorCount={allTotp.length}
          lastCheckAt={lastCheckAt}
          lastCheckLabel={lastCheckLabel}
          booting={booting}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <SecurityMfaPanel
            mfaEnabled={mfaEnabled}
            backupConfigured={backupConfigured}
            allTotpCount={allTotp.length}
            loading={loading}
            booting={booting}
            enroll={enroll}
            otp={otp}
            setOtp={setOtp}
            startEnroll={startEnroll}
            disableMfa={disableMfa}
            verifyEnroll={verifyEnroll}
          />

          <SecurityRecommendations
            mfaEnabled={mfaEnabled}
            backupConfigured={backupConfigured}
            lastCheckAt={lastCheckAt}
            lastCheckLabel={lastCheckLabel}
            loading={loading}
            booting={booting}
            onStartEnroll={startEnroll}
            onMarkReviewed={bumpLastSecurityCheck}
          />
        </div>

        {booting && (
          <p className="mt-4 text-xs text-gray-400">Loading security settings…</p>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-gray-400">
          <span>Security changes are handled through encrypted Supabase Auth MFA factors.</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="gl-btn gl-btn-secondary gl-btn-sm"
          >
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </main>
    </div>
  );
}
