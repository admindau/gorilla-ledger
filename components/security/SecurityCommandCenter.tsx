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

function protectionState({
  mfaEnabled,
  backupConfigured,
  lastCheckAt,
}: Pick<SecurityCommandCenterProps, "mfaEnabled" | "backupConfigured" | "lastCheckAt">) {
  const checkAge = daysSince(lastCheckAt);
  if (!mfaEnabled) return { label: "At risk", detail: "No verified sign-in factor" };
  if (!backupConfigured) return { label: "Protected", detail: "Add backup access" };
  if (checkAge === null || checkAge > 30) return { label: "Review due", detail: "Confirm recovery access" };
  return { label: "Strong", detail: "Core controls are active" };
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
    <div className="gl-premium-card min-w-0 p-3.5 sm:p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-3 break-words text-xl font-semibold text-white sm:text-2xl">{value}</p>
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
  const state = protectionState({ mfaEnabled, backupConfigured, lastCheckAt });
  const checkAge = daysSince(lastCheckAt);
  const reviewCurrent = checkAge !== null && checkAge <= 30;
  const protectionStrong = mfaEnabled && backupConfigured;

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <div className="gl-premium-card min-w-0 p-3.5 sm:p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
            Protection status
          </p>
          <p className="mt-3 text-xl font-semibold text-white sm:text-2xl">{booting ? "Checking…" : state.label}</p>
          <p className="mt-1 text-xs text-gray-400">{booting ? "Resolving account controls" : state.detail}</p>
        </div>

        <StatCard
          label="MFA"
          value={mfaEnabled ? "Enabled" : "Disabled"}
          detail={mfaEnabled ? "Authenticator protection active" : "Enable MFA to protect sign-ins"}
        />

        <StatCard
          label="Backup access"
          value={backupConfigured ? "Ready" : "Incomplete"}
          detail={backupConfigured ? "Backup authenticator configured" : "Add a backup authenticator"}
        />

        <StatCard
          label="Last checked"
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
