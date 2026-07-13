import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

type NativeButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type LinkButtonProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

const variantClass: Record<ButtonVariant, string> = {
  primary: "gl-btn-primary",
  secondary: "gl-btn-secondary",
  ghost: "gl-btn-ghost",
  danger: "gl-btn-danger",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "gl-btn-sm",
  md: "gl-btn-md",
  lg: "gl-btn-lg",
};

function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: Pick<CommonProps, "variant" | "size" | "className">) {
  return ["gl-btn gl-motion", variantClass[variant], sizeClass[size], className]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: NativeButtonProps | LinkButtonProps) {
  const { children, variant = "primary", size = "md", className = "", ...rest } = props;
  const classes = buttonClass({ variant, size, className });

  if ("href" in rest && rest.href) {
    const { href, ...anchorProps } = rest;
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button
      type={buttonProps.type ?? "button"}
      className={classes}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
