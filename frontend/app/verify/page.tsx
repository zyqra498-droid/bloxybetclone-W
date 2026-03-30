"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";

export default function VerifyPage() {
  const [serverSeed, setServerSeed] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [nonce, setNonce] = useState("");
  const [out, setOut] = useState<string | null>(null);

  async function run() {
    const res = await apiFetch("/api/verify/coinflip", {
      method: "POST",
      body: JSON.stringify({ serverSeed, clientSeed, nonce }),
    });
    const j = await res.json();
    setOut(JSON.stringify(j, null, 2));
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <BloxyPageHeader
        title="Verify roll"
        subtitle="After a coinflip completes, paste the revealed server seed with client seed and nonce to recompute the outcome locally."
        eyebrow="Provably fair"
      />

      <div className="rounded-2xl border border-border-default bg-bg-secondary/95 p-6 shadow-card">
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted">Server seed</label>
          <input
            className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            value={serverSeed}
            onChange={(e) => setServerSeed(e.target.value)}
          />
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted">Client seed</label>
          <input
            className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            value={clientSeed}
            onChange={(e) => setClientSeed(e.target.value)}
          />
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted">Nonce</label>
          <input
            className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            value={nonce}
            onChange={(e) => setNonce(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void run()}
            className="w-full rounded-xl bg-accent-cyan py-3 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110"
          >
            Verify coinflip roll
          </button>
        </div>
        {out && (
          <pre className="mt-4 max-h-64 overflow-x-auto rounded-xl border border-border-default bg-bg-primary p-3 text-xs text-accent-cyan">
            {out}
          </pre>
        )}
      </div>
    </div>
  );
}
