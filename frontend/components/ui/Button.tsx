"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

const spinner = (
  <svg className="h-4 w-4 animate-spin text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gold";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent-purple text-white hover:brightness-110",
  secondary:
    "bg-bg-tertiary border border-border-default text-text-primary hover:border-border-hover",
  ghost: "bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary",
  danger: "bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red/20",
  gold: "bg-accent-gold text-black hover:brightness-110",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3 text-sm",
  md: "min-h-[44px] px-4 text-sm",
  lg: "min-h-[48px] px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    disabled,
    className = "",
    children,
    type = "button",
    onClick,
    ...rest
  },
  ref,
) {
  const isDisabled = Boolean(disabled || loading);
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      {loading ? spinner : null}
      {children}
    </button>
  );
});
