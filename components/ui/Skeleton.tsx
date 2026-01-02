import * as React from "react";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Optional rounded preset */
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
};

const roundedMap: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

export default function Skeleton({
  className = "",
  rounded = "xl",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={[
        "animate-pulse bg-white/10 border border-white/5",
        roundedMap[rounded],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
