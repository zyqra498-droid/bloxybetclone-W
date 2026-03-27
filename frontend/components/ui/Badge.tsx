"use client";

import type { ReactNode } from "react";

export type BadgeVariant = "purple" | "gold" | "green" | "red" | "blue" | "gray";
export type BadgeSize = "sm" | "md";

const variantClass: Record<BadgeVariant, string> = {
  purple: "bg-accent-purple/20 text-accent-purple border-accent-purple/30",
  gold: "bg-accent-gold/20 text-accent-gold border-accent-gold/30",
  green: "bg-accent-green/20 text-accent-green border-accent-green/30",
  red: "bg-accent-red/20 text-accent-red border-accent-red/30",
  blue: "bg-accent-blue/20 text-accent-blue border-accent-blue/30",
  gray: "bg-bg-tertiary text-text-secondary border-border-default",
};

const sizeClass: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

export type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
};

export function Badge({ children, variant = "gray", size = "sm", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border font-medium ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {children}
    </span>
  );
}
