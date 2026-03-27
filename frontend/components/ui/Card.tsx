"use client";

import type { ReactNode } from "react";

type Glow = "purple" | "gold" | "green" | "none";

const glowClass: Record<Glow, string> = {
  purple: "shadow-glow-purple",
  gold: "shadow-glow-gold",
  green: "shadow-glow-green",
  none: "",
};

export type CardProps = {
  children: ReactNode;
  className?: string;
  glow?: Glow;
  onClick?: () => void;
};

export function Card({ children, className = "", glow = "none", onClick }: CardProps) {
  const interactive = Boolean(onClick);
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`rounded-card border border-border-default bg-bg-secondary shadow-card ${glowClass[glow]} ${interactive ? "cursor-pointer transition hover:border-border-hover" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
