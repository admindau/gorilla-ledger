import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "neutral" | "success" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
};

const variantClass: Record<BadgeVariant, string> = {
  neutral: "gl-badge-neutral",
  success: "gl-badge-success",
  warning: "gl-badge-warning",
  danger: "gl-badge-danger",
};

export function Badge({ children, variant = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span className={["gl-badge", variantClass[variant], className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}
