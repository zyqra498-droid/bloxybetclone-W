"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { formatCoins } from "@/lib/format";

export type JackpotWheelSegment = {
  userId: string;
  username: string;
  pct: number;
  color: string;
};

function segmentMidpoints(segments: { pct: number }[]): number[] {
  let acc = 0;
  return segments.map((s) => {
    const mid = acc + s.pct / 2;
    acc += s.pct;
    return mid;
  });
}

export function JackpotSpinWheel({
  segments,
  coneStops,
  totalValue,
  remain,
  spinRotation,
  serverSeedHash,
}: {
  segments: JackpotWheelSegment[];
  coneStops: string;
  totalValue: number;
  remain: number | null;
  spinRotation: number;
  serverSeedHash?: string | null;
}) {
  const mids = useMemo(() => segmentMidpoints(segments), [segments]);

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <div className="absolute -top-0.5 left-1/2 z-30 -translate-x-1/2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
        <div className="h-0 w-0 border-l-[14px] border-r-[14px] border-t-[22px] border-l-transparent border-r-transparent border-t-accent-gold" />
      </div>

      <div className="rounded-full bg-gradient-to-b from-accent-cyan/20 to-bg-tertiary p-1.5 shadow-glow-cyan ring-2 ring-white/5">
        <div className="relative aspect-square w-full rounded-full bg-bg-primary p-1">
          <motion.div
            className="absolute inset-1 rounded-full border-[3px] border-white/10 shadow-[inset_0_0_32px_rgba(0,0,0,0.45)]"
            style={{
              background:
                segments.length > 0 ? `conic-gradient(${coneStops})` : "conic-gradient(#25262b 0% 100%)",
            }}
            animate={{ rotate: spinRotation }}
            transition={{ duration: 4, ease: [0.2, 0.85, 0.15, 1] }}
          >
            {segments.length > 0 &&
              mids.map((mid, i) => {
                const deg = (mid / 100) * 360 - 90;
                const rad = (deg * Math.PI) / 180;
                const r = 36;
                const x = 50 + r * Math.cos(rad);
                const y = 50 + r * Math.sin(rad);
                const s = segments[i];
                return (
                  <div
                    key={s.userId}
                    className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-bg-primary bg-bg-secondary/95 text-[9px] font-bold uppercase tracking-tighter text-text-primary shadow-md"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    title={s.username}
                  >
                    {s.username.slice(0, 2)}
                  </div>
                );
              })}
          </motion.div>

          <div className="pointer-events-none absolute inset-[14%] z-20 flex items-center justify-center rounded-full border-4 border-bg-secondary bg-bg-primary shadow-[inset_0_0_48px_rgba(0,0,0,0.55)]">
            <div className="px-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-muted">Pot</p>
              <motion.p
                className="mt-0.5 font-display text-2xl font-extrabold tabular-nums text-accent-cyan sm:text-3xl"
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              >
                ◈ {formatCoins(totalValue)}
              </motion.p>
              {remain !== null && remain >= 0 && (
                <p className="mt-1 font-display text-base tabular-nums text-accent-blue">
                  {Math.floor(remain / 60)}:{String(remain % 60).padStart(2, "0")}
                </p>
              )}
              <p className="mt-1 text-[10px] text-text-muted">
                {segments.length} player{segments.length === 1 ? "" : "s"} · rolls weighted by ◈
              </p>
            </div>
          </div>
        </div>
      </div>

      {serverSeedHash && (
        <p className="mt-4 max-w-full break-all text-center font-mono text-[10px] text-text-secondary">
          # {serverSeedHash.slice(0, 20)}…
        </p>
      )}
    </div>
  );
}
