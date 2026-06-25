import TrustIndicator from "@/components/ui/TrustIndicator";

type SecurityCommandCenterProps = {
  mfaEnabled: boolean;
  backupConfigured: boolean;
  factorCount: number;
  lastCheckAt: number | null;
  lastCheckLabel: string;
  booting?: boolean;
};

function daysSince(ms: number | null) {
  if (!ms || ms <= 0) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
}

function securityScore({
  mfaEnabled,
  backupConfigured,
  lastCheckAt,
}: Pick<SecurityCommandCenterProps, "mfaEnabled" | "backupConfigured" | "lastCheckAt">) {
  const checkAge = daysSince(lastCheckAt);
  let score = 20;

  if (mfaEnabled) score += 40;
  if (backupConfigured) score += 25;
  if (checkAge !== null && checkAge <= 30) score += 15;

  return Math.min(score, 100);
}

function scoreLabel(score: number) {
  if (score >= 85) return "Strong";
  if (score >= 65) return "Good";
  return "Needs attention";
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="gl-premium-card p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-gray-400">{detail}</p> : null}
    </div>
  );
}

export function SecurityCommandCenter({
  mfaEnabled,
  backupConfigured,
  factorCount,
  lastCheckAt,
  lastCheckLabel,
  booting = false,
}: SecurityCommandCenterProps) {
  const score = securityScore({ mfaEnabled, backupConfigured, lastCheckAt });
  const label = scoreLabel(score);
  const checkAge = daysSince(lastCheckAt);
  const reviewCurrent = checkAge !== null && checkAge <= 30;
  const protectionStrong = mfaEnabled && backupConfigured;

  return (
    <section className="space-y-4">
      <div className="gl-premium-card overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
              Security Trust Layer
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
              Account protection status
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">
              Gorilla Ledger™ uses MFA readiness, recovery coverage, and review freshness to help you understand whether your account protection is current.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <TrustIndicator
              status={mfaEnabled ? "success" : "warning"}
              label={mfaEnabled ? "MFA protected" : "MFA needed"}
              detail={mfaEnabled ? "Authenticator active" : "Enable authenticator"}
            />
            <TrustIndicator
              status={backupConfigured ? "success" : "warning"}
              label={backupConfigured ? "Recovery ready" : "Recovery incomplete"}
              detail={backupConfigured ? "Backup factor present" : "Add backup factor"}
            />
            <TrustIndicator
              status={reviewCurrent ? "success" : "warning"}
              label={reviewCurrent ? "Recently reviewed" : "Review recommended"}
              detail={lastCheckLabel}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="gl-premium-card p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
            Security Score
          </p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-3xl font-semibold text-white">{booting ? "…" : score}</p>
            <p className="pb-1 text-sm text-gray-400">/ 100</p>
          </div>
          <p className="mt-1 text-xs text-gray-400">{booting ? "Checking status…" : label}</p>
        </div>

        <StatCard
          label="MFA Status"
          value={mfaEnabled ? "Enabled" : "Disabled"}
          detail={mfaEnabled ? "Authenticator protection active" : "Enable MFA to protect sign-ins"}
        />

        <StatCard
          label="Recovery Status"
          value={backupConfigured ? "Ready" : "Incomplete"}
          detail={backupConfigured ? "Backup authenticator configured" : "Add a backup authenticator"}
        />

        <StatCard
          label="Protection Review"
          value={reviewCurrent ? "Current" : "Review"}
          detail={
            protectionStrong
              ? `${factorCount} authenticator factor${factorCount === 1 ? "" : "s"} · ${lastCheckLabel}`
              : `${factorCount} authenticator factor${factorCount === 1 ? "" : "s"} · strengthen setup`
          }
        />
      </div>
    </section>
  );
}
