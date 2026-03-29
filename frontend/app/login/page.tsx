"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { broadcastAuthLogin, useAuth } from "@/contexts/AuthContext";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";

export default function LoginPage() {
  const router = useRouter();
  const { isCsrfReady: ready, refreshMe } = useAuth();
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startChallenge() {
    setErr(null);
    setLoading(true);
    const res = await apiFetch("/api/auth/bio/start", { method: "POST", body: "{}" });
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : "Could not start verification.");
      return;
    }
    setChallengeId(j.challengeId);
    setCode(j.code);
    setExpiresAt(j.expiresAt ?? null);
  }

  async function verify() {
    if (!challengeId) return;
    setErr(null);
    setLoading(true);
    const res = await apiFetch("/api/auth/bio/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId, username: username.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : "Verification failed.");
      return;
    }
    await refreshMe();
    broadcastAuthLogin();
    router.replace("/wallet?login=1");
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <BloxyPageHeader
        title="Login"
        subtitle="Verify you own your Roblox account with a one-time bio code — BloxyBet-style secure onboarding."
        eyebrow="Roblox bio"
      />

      <div className="rounded-2xl border border-border-default bg-bg-secondary/95 p-6 shadow-card sm:p-8">
        {!ready && <p className="text-sm text-text-secondary">Preparing…</p>}

        {ready && !challengeId && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void startChallenge()}
            className="w-full rounded-xl bg-accent-cyan py-3.5 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Working…" : "Get verification code"}
          </button>
        )}

        {code && (
          <div className="rounded-xl border border-accent-cyan/25 bg-accent-cyan/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Your code</p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-accent-cyan">{code}</p>
            {expiresAt && (
              <p className="mt-2 text-xs text-text-secondary">Expires: {new Date(expiresAt).toLocaleString()}</p>
            )}
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
              <li>Open your Roblox profile → About / Description.</li>
              <li>Paste the code above anywhere in your bio and save.</li>
              <li>Enter your Roblox username below (exact spelling) and click Verify.</li>
              <li>After login, you can remove the code from your bio.</li>
            </ol>
          </div>
        )}

        {challengeId && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-primary">
              Roblox username
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. RobloxPlayer123"
                className="mt-1 w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:border-accent-cyan/40 focus:outline-none"
              />
            </label>
            <button
              type="button"
              disabled={loading || username.trim().length < 3}
              onClick={() => void verify()}
              className="w-full rounded-xl bg-accent-cyan py-3.5 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & log in"}
            </button>
          </div>
        )}

        {err && (
          <p className="mt-4 rounded-xl border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">{err}</p>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link href="/" className="font-semibold text-accent-cyan hover:underline">
            ← Back home
          </Link>
        </p>
      </div>
    </div>
  );
}
