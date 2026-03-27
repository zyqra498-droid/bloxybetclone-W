"use client";

import type { CSSProperties } from "react";

export type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  className?: string;
};

export function Skeleton({ width = "100%", height = 16, className = "" }: SkeletonProps) {
  const style: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-card border border-border-default bg-bg-secondary p-3 shadow-card">
      <Skeleton height={120} className="w-full rounded-lg" />
      <Skeleton height={14} className="mt-3 w-3/4" />
      <Skeleton height={12} className="mt-2 w-1/2" />
      <Skeleton height={12} className="mt-2 w-2/3" />
    </div>
  );
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
