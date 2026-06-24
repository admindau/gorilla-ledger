import type { HTMLAttributes, ReactNode } from "react";

type PageSectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  title?: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  spacious?: boolean;
};

export function PageSection({
  children,
  title,
  description,
  eyebrow,
  action,
  spacious = false,
  className = "",
  ...props
}: PageSectionProps) {
  return (
    <section
      className={["gl-page-section", spacious ? "gl-page-section-spacious" : "", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {title || description || eyebrow || action ? (
        <div className="gl-page-section-header">
          <div className="min-w-0">
            {eyebrow ? <p className="gl-page-section-eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="gl-page-section-title">{title}</h2> : null}
            {description ? <p className="gl-page-section-description">{description}</p> : null}
          </div>
          {action ? <div className="gl-page-section-action">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
