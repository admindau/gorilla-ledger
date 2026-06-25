import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  interactive?: boolean;
  variant?: "default" | "premium" | "inner";
};

export function Card({
  children,
  className = "",
  interactive = false,
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        variant === "premium" ? "gl-premium-card gl-card" : variant === "inner" ? "gl-inner-card gl-card" : "gl-card",
        interactive ? "gl-card-interactive gl-motion" : "",
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
