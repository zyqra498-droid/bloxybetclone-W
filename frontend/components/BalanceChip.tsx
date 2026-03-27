"use client";

import CountUp from "react-countup";

export function BalanceChip({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-border bg-bg-tertiary px-3 py-1 font-display text-sm font-bold text-accent-gold">
      ◈{" "}
      <CountUp
        end={value}
        duration={0.55}
        decimals={0}
        separator=","
        preserveValue
      />
    </span>
  );
}
