import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Card } from "@/components/ui/Card";

type EnrollState =
  | { status: "idle" }
  | { status: "enrolling"; qr: string; secret: string; factorId: string }
  | { status: "enabled" };

type SecurityMfaPanelProps = {
  mfaEnabled: boolean;
  backupConfigured: boolean;
  allTotpCount: number;
  loading: boolean;
  booting: boolean;
  enroll: EnrollState;
  otp: string;
  setOtp: Dispatch<SetStateAction<string>>;
  startEnroll: () => void;
  disableMfa: () => void;
  verifyEnroll: (event: FormEvent) => void;
};

export function SecurityMfaPanel({
  mfaEnabled,
  backupConfigured,
  allTotpCount,
  loading,
  booting,
  enroll,
  otp,
  setOtp,
  startEnroll,
  disableMfa,
  verifyEnroll,
}: SecurityMfaPanelProps) {
  return (
    <Card variant="premium" className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
            Account Protection
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Multi-factor authentication
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Use Google Authenticator, Microsoft Authenticator, Authy, 1Password,
            or another TOTP-compatible app to protect sensitive financial records.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
          {mfaEnabled ? (
            <>
              {!backupConfigured ? (
                <button
                  type="button"
                  onClick={startEnroll}
                  disabled={loading || booting}
                  className="gl-btn gl-btn-primary gl-btn-md"
                >
                  Add backup factor
                </button>
              ) : null}

              <button
                type="button"
                onClick={disableMfa}
                disabled={loading || booting}
                className="gl-btn gl-btn-danger gl-btn-md"
              >
                Disable MFA
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEnroll}
              disabled={loading || booting}
              className="gl-btn gl-btn-primary gl-btn-md"
            >
              Enable MFA
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Status</p>
          <p className={["mt-2 text-sm font-semibold", mfaEnabled ? "text-emerald-300" : "text-yellow-300"].join(" ")}>
            {mfaEnabled ? "Enabled" : "Not enabled"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Backup</p>
          <p className={["mt-2 text-sm font-semibold", backupConfigured ? "text-emerald-300" : "text-yellow-300"].join(" ")}>
            {backupConfigured ? "Configured" : "Not configured"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Factors</p>
          <p className="mt-2 text-sm font-semibold text-white">{allTotpCount}</p>
        </div>
      </div>

      {!backupConfigured ? (
        <div className="mt-5 rounded-2xl border border-yellow-500/30 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-100">
          Savvy Gorilla™ does not provide recovery codes. For account recovery,
          enroll a backup authenticator factor on a different device or app.
        </div>
      ) : null}

      {enroll.status === "enrolling" ? (
        <div className="mt-6 border-t border-white/10 pt-6">
          <h3 className="text-sm font-semibold text-white">Complete enrollment</h3>
          <p className="mt-1 text-sm text-gray-400">
            Scan the QR code in your authenticator app, then enter the 6-digit code.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
              <div
                className="w-full overflow-hidden rounded-xl bg-white p-2"
                dangerouslySetInnerHTML={{ __html: enroll.qr }}
              />
            </div>

            <form onSubmit={verifyEnroll} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-gray-400">6-digit code</label>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-white/40"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="gl-btn gl-btn-primary gl-btn-md w-full"
              >
                Verify & enable
              </button>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-gray-400">
                Secret: <span className="break-all text-gray-200">{enroll.secret}</span>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
