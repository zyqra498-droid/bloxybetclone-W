"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import type { Me } from "@/lib/types";

type CaseDef = { id: string; slug: string; name: string; poolJson?: unknown };
type LobbyRow = {
  id: string;
  status: string;
  maxPlayers: number;
  createdAt: string;
  case: { id: string; name: string; slug: string };
  players: { userId: string; username: string; avatarUrl: string | null; joinedAt: string }[];
};
type BattleDetail = {
  id: string;
  status: string;
  maxPlayers: number;
  serverSeedHash: string | null;
  resultHash: string | null;
  winnerUserId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  case: { id: string; name: string; slug: string; poolJson?: unknown };
  players: {
    userId: string;
    username: string;
    avatarUrl: string | null;
    joinedAt: string;
    rollJson: unknown;
  }[];
};

export default function CaseBattlesPage() {
  const { isLoggedIn, user: authUser } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [cases, setCases] = useState<CaseDef[]>([]);
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BattleDetail | null>(null);
  const [caseId, setCaseId] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCasesAndLobbies = useCallback(async () => {
    const [cRes, lRes, mRes] = await Promise.all([
      fetch("/api/games/case-battles/cases").then((r) => r.json()),
      fetch("/api/games/case-battles/list").then((r) => r.json()),
      apiFetch("/api/auth/me").then(async (r) => (r.ok ? ((await r.json()) as Me) : null)),
    ]);
    setCases(cRes.cases ?? []);
    setLobbies(lRes.battles ?? []);
    setMe(mRes);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const r = await fetch(`/api/games/case-battles/${encodeURIComponent(id)}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.battle) setDetail(j.battle as BattleDetail);
    else setDetail(null);
  }, []);

  useEffect(() => {
    void loadCasesAndLobbies();
    const t = setInterval(() => void loadCasesAndLobbies(), 5000);
    return () => clearInterval(t);
  }, [loadCasesAndLobbies]);

  useEffect(() => {
    if (cases.length > 0 && !caseId) setCaseId(cases[0].id);
  }, [cases, caseId]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function createLobby() {
    if (!isLoggedIn) {
      setErr("Log in to create a lobby.");
      return;
    }
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiFetch("/api/games/case-battles/create", {
        method: "POST",
        body: JSON.stringify({ caseId, maxPlayers }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not create lobby.");
        return;
      }
      setMsg(`Lobby created: ${j.battleId?.slice(0, 12) ?? "ok"}…`);
      setSelectedId(j.battleId ?? null);
      await loadCasesAndLobbies();
    } finally {
      setBusy(false);
    }
  }

  async function joinLobby(id: string) {
    if (!isLoggedIn) {
      setErr("Log in to join.");
      return;
    }
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiFetch(`/api/games/case-battles/join/${encodeURIComponent(id)}`, { method: "POST", body: "{}" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Join failed.");
        return;
      }
      setMsg("Joined lobby.");
      setSelectedId(id);
      await loadCasesAndLobbies();
      await loadDetail(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <BloxyPageHeader
          title="Case battles"
          subtitle="Open shared case lobbies: pick a case, set seats (2–4), then join others or start your own. Rolls and payouts are stubbed until the battle engine is finished."
          eyebrow="Upgrade"
        />
      </motion.div>

      {msg && <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{msg}</p>}
      {err && <p className="rounded-lg bg-accent-red/15 px-3 py-2 text-sm text-accent-red">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border-default bg-bg-secondary/95 p-5 shadow-card">
          <h2 className="font-display text-lg font-bold text-text-primary">Create lobby</h2>
          {cases.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">
              No case definitions in the database yet. Add rows to <code className="text-accent-cyan">case_definitions</code> (e.g.
              Prisma seed) so players can start battles.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-text-secondary">Case</span>
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-text-primary"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.slug})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-text-secondary">Max players</span>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-text-primary"
                >
                  {[2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy || !isLoggedIn}
                onClick={() => void createLobby()}
                className="min-h-[44px] w-full rounded-xl bg-accent-cyan px-4 text-sm font-bold text-[#0a0e14] shadow-glow-cyan disabled:opacity-50"
              >
                {isLoggedIn ? "Create & join as host" : "Log in to create"}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border-default bg-bg-secondary/95 p-5 shadow-card">
          <h2 className="font-display text-lg font-bold text-text-primary">Open lobbies</h2>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
            {lobbies.map((b) => {
              const full = b.players.length >= b.maxPlayers;
              const inLobby = me?.id && b.players.some((p) => p.userId === me.id);
              return (
                <li key={b.id} className="rounded-xl border border-border-default/80 bg-bg-tertiary/50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-text-primary">{b.case.name}</p>
                      <p className="text-xs text-text-secondary">
                        {b.players.length}/{b.maxPlayers} players · {new Date(b.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(b.id)}
                        className="rounded-xl border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover"
                      >
                        View
                      </button>
                      {isLoggedIn && !full && !inLobby && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void joinLobby(b.id)}
                          className="rounded-pill bg-accent-gold px-3 py-1.5 text-xs font-medium text-bg-primary disabled:opacity-50"
                        >
                          Join
                        </button>
                      )}
                      {inLobby && <span className="self-center text-xs text-success">You’re in</span>}
                      {full && !inLobby && <span className="self-center text-xs text-text-secondary">Full</span>}
                    </div>
                  </div>
                </li>
              );
            })}
            {lobbies.length === 0 && <li className="text-text-secondary">No open lobbies — create one.</li>}
          </ul>
        </section>
      </div>

      {detail && (
        <section className="rounded-2xl border border-border-default bg-bg-secondary/95 p-5 shadow-card">
          <h2 className="font-display text-lg font-bold text-text-primary">Battle detail</h2>
          <p className="mt-1 font-mono text-xs text-text-secondary">{detail.id}</p>
          <p className="mt-2 text-sm text-text-secondary">
            <span className="text-text-primary">{detail.case.name}</span> · status: {detail.status} · {detail.players.length}/
            {detail.maxPlayers} players
          </p>
          {detail.serverSeedHash && (
            <p className="mt-2 break-all text-xs text-text-secondary">Seed hash: {detail.serverSeedHash}</p>
          )}
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {detail.players.map((p) => (
              <li key={p.userId} className="flex items-center gap-2 rounded-xl border border-border-default/60 bg-bg-tertiary/40 px-3 py-2">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-hover text-sm">
                    {p.username.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{p.username}</p>
                  <p className="text-xs text-text-secondary">{p.userId === authUser?.id ? "You" : "Player"}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/market" className="mt-4 inline-block text-sm font-semibold text-accent-cyan hover:underline">
            ← Back to market
          </Link>
        </section>
      )}
    </div>
  );
}
