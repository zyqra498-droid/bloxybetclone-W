"use client";

import CountUpLib from "react-countup";

export type CountUpProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
};

export function CountUp({ value, prefix = "", suffix = "", decimals = 0, duration = 0.5, className = "" }: CountUpProps) {
  return (
    <CountUpLib
      end={value}
      decimals={decimals}
      duration={duration}
      prefix={prefix}
      suffix={suffix}
      separator=","
      preserveValue
      className={className}
    />
  );
}
