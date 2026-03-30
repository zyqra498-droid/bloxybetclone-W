"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";

export default function ProvablyFairPage() {
  const [gameId, setGameId] = useState("");
  const [kind, setKind] = useState<"coinflip" | "jackpot">("coinflip");
  const [out, setOut] = useState<object | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function lookup() {
    setErr(null);
    setOut(null);
    const path =
      kind === "coinflip"
        ? `/api/games/coinflip/round/${encodeURIComponent(gameId)}`
        : `/api/games/jackpot/round/${encodeURIComponent(gameId)}`;
    const r = await fetch(path, { credentials: "include" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(typeof j.error === "string" ? j.error : "Lookup failed");
      return;
    }
    setOut(j as object);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <BloxyPageHeader
        title="Provably fair"
        subtitle="Every coinflip and jackpot stores a server seed hash before play. After resolution, the server seed is revealed so you can verify the SHA-256 commitment and recompute the winning ticket or side."
        eyebrow="Verify"
      />

      <section className="rounded-2xl border border-border-default bg-bg-secondary/95 p-6 shadow-card">
        <h2 className="font-display text-lg font-bold text-text-primary">Verify a game</h2>
        <p className="mt-1 text-sm text-text-secondary">Paste a completed round ID from coinflip or jackpot.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "coinflip" | "jackpot")}
            className="rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
          >
            <option value="coinflip">Coinflip</option>
            <option value="jackpot">Jackpot</option>
          </select>
          <input
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Round ID"
            className="min-w-[200px] flex-1 rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary"
          />
          <button
            type="button"
            onClick={() => void lookup()}
            className="rounded-xl bg-accent-cyan px-4 py-2 text-sm font-bold text-[#0a0e14] shadow-glow-cyan"
          >
            Load
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-accent-red">{err}</p>}
        {out && (
          <pre className="mt-4 max-h-96 overflow-auto rounded-xl border border-border-default bg-bg-primary p-4 text-xs text-accent-cyan">
            {JSON.stringify(out, null, 2)}
          </pre>
        )}
      </section>

      <section className="rounded-2xl border border-border-default bg-bg-secondary/95 p-6 shadow-card">
        <h2 className="font-display text-lg font-bold text-text-primary">Manual verify (coinflip roll)</h2>
        <p className="text-sm text-text-secondary">Use POST /api/verify/coinflip with seeds from a completed round.</p>
        <Link href="/verify" className="mt-2 inline-block font-semibold text-accent-cyan hover:underline">
          Open legacy verify tool →
        </Link>
      </section>
    </div>
  );
}
