import type { ReactNode } from "react";

type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  eyebrow,
  title,
  description,
  action,
  icon,
  compact = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={["gl-empty-state", compact ? "gl-empty-state-compact" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? <div className="gl-empty-state-icon">{icon}</div> : null}
      {eyebrow ? <p className="gl-empty-state-eyebrow">{eyebrow}</p> : null}
      <h3 className="gl-empty-state-title">{title}</h3>
      {description ? <p className="gl-empty-state-description">{description}</p> : null}
      {action ? <div className="gl-empty-state-action">{action}</div> : null}
    </div>
  );
}
