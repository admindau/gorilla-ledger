import type { HTMLAttributes, ReactNode } from "react";

type PageShellProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "full";
  bleed?: boolean;
};

const sizeClass: Record<NonNullable<PageShellProps["size"]>, string> = {
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

export function PageShell({
  children,
  className = "",
  size = "xl",
  bleed = false,
  ...props
}: PageShellProps) {
  return (
    <div
      className={[
        "gl-page-shell",
        bleed ? "gl-page-shell-bleed" : "",
        sizeClass[size],
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
