import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type SecurityRecommendationsProps = {
  mfaEnabled: boolean;
  backupConfigured: boolean;
  lastCheckAt: number | null;
  lastCheckLabel: string;
  loading: boolean;
  booting: boolean;
  onStartEnroll: () => void;
  onMarkReviewed: () => void;
};

function daysSince(ms: number | null) {
  if (!ms || ms <= 0) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
}

function RecommendationItem({
  status,
  title,
  description,
  action,
}: {
  status: "complete" | "warning" | "action";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const icon =
    status === "complete" ? "✓" : status === "warning" ? "!" : "→";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
            status === "complete"
              ? "border-emerald-400/40 text-emerald-300"
              : status === "warning"
                ? "border-yellow-400/40 text-yellow-300"
                : "border-white/20 text-white",
          ].join(" ")}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-gray-400">{description}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function SecurityRecommendations({
  mfaEnabled,
  backupConfigured,
  lastCheckAt,
  lastCheckLabel,
  loading,
  booting,
  onStartEnroll,
  onMarkReviewed,
}: SecurityRecommendationsProps) {
  const reviewAge = daysSince(lastCheckAt);
  const reviewIsFresh = reviewAge !== null && reviewAge <= 30;

  return (
    <Card variant="premium" className="p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
        Checklist
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white">Protection checklist</h2>

      <div className="mt-5 space-y-3">
        <RecommendationItem
          status={mfaEnabled ? "complete" : "action"}
          title={mfaEnabled ? "MFA is enabled" : "Enable multi-factor authentication"}
          description={
            mfaEnabled
              ? "An authenticator app protects your sign-ins."
              : "Add an authenticator app to protect your sign-ins."
          }
          action={
            !mfaEnabled ? (
              <button
                type="button"
                onClick={onStartEnroll}
                disabled={loading || booting}
                className="gl-btn gl-btn-primary gl-btn-sm"
              >
                Enable MFA
              </button>
            ) : undefined
          }
        />

        <RecommendationItem
          status={backupConfigured ? "complete" : "warning"}
          title={backupConfigured ? "Backup factor configured" : "Add a backup authenticator"}
          description={
            backupConfigured
              ? "A second authenticator is available if you lose access."
              : "Use a different device or app so account access is not tied to one authenticator."
          }
          action={
            mfaEnabled && !backupConfigured ? (
              <button
                type="button"
                onClick={onStartEnroll}
                disabled={loading || booting}
                className="gl-btn gl-btn-secondary gl-btn-sm"
              >
                Add backup
              </button>
            ) : undefined
          }
        />

        <RecommendationItem
          status={reviewIsFresh ? "complete" : "warning"}
          title={reviewIsFresh ? "Security checked" : "Review security settings"}
          description={
            reviewIsFresh
              ? `Last reviewed ${lastCheckLabel}.`
              : "Mark this page as reviewed after confirming your authentication setup."
          }
          action={
            !reviewIsFresh ? (
              <button
                type="button"
                onClick={onMarkReviewed}
                className="gl-btn gl-btn-secondary gl-btn-sm"
              >
                Mark reviewed
              </button>
            ) : undefined
          }
        />
      </div>
    </Card>
  );
}
