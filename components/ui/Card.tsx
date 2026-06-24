import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  interactive?: boolean;
};

export function Card({ children, className = "", interactive = false, ...props }: CardProps) {
  return (
    <div
      className={[
        "gl-card",
        interactive ? "gl-card-interactive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }: CardProps) {
  return (
    <div className={["gl-card-header", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "", ...props }: CardProps) {
  return (
    <div className={["gl-card-body", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}
