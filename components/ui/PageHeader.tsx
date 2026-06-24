import type { ReactNode } from "react";
import { Button } from "./Button";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  align?: "start" | "center";
};

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Back to Dashboard",
  action,
  align = "start",
}: PageHeaderProps) {
  return (
    <div className={["gl-page-header", align === "center" ? "gl-page-header-center" : ""].filter(Boolean).join(" ")}>
      <div className="min-w-0">
        {eyebrow ? <p className="gl-page-eyebrow">{eyebrow}</p> : null}
        <h1 className="gl-page-title">{title}</h1>
        {description ? <p className="gl-page-description">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {backHref ? (
          <Button href={backHref} variant="secondary" size="sm">
            {backLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
