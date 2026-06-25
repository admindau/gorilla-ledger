type TrustIndicatorStatus = "success" | "warning" | "info";

type TrustIndicatorProps = {
  label: string;
  detail?: string;
  status?: TrustIndicatorStatus;
  compact?: boolean;
  className?: string;
};

const statusClasses: Record<TrustIndicatorStatus, string> = {
  success: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100",
  warning: "border-amber-300/20 bg-amber-300/[0.08] text-amber-100",
  info: "border-white/10 bg-white/[0.06] text-gray-100",
};

const dotClasses: Record<TrustIndicatorStatus, string> = {
  success: "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.35)]",
  warning: "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.35)]",
  info: "bg-gray-300 shadow-[0_0_12px_rgba(209,213,219,0.25)]",
};

export default function TrustIndicator({
  label,
  detail,
  status = "info",
  compact = false,
  className = "",
}: TrustIndicatorProps) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full border backdrop-blur",
        compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
        statusClasses[status],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "h-1.5 w-1.5 rounded-full",
          dotClasses[status],
        ].join(" ")}
      />
      <span className="font-medium uppercase tracking-[0.16em]">{label}</span>
      {detail ? (
        <span className="hidden text-gray-400 sm:inline">· {detail}</span>
      ) : null}
    </div>
  );
}
