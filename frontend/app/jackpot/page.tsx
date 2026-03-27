"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import type { SiteItem, Me } from "@/lib/types";
import { getSocket } from "@/lib/socket";
import { AsyncButton } from "@/components/AsyncButton";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";
import { JackpotSpinWheel, type JackpotWheelSegment } from "@/components/bloxy/JackpotSpinWheel";
import { formatCoins } from "@/lib/format";

type Round = {
  id: string;
  totalValue: number;
  totalTickets: string;
  serverSeedHash?: string | null;
  endsAt?: string | null;
  entries: { userId: string; username: string; chance: number; valueCoins: number }[];
};

const COLORS = ["#7c5cfc", "#4f8ef7", "#f5c542", "#3b82f6", "#ff4d4d", "#8888aa", "#ff6584"];

export default function JackpotPage() {
  const [round, setRound] = useState<Round | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [siteItems, setSiteItems] = useState<SiteItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [remain, setRemain] = useState<number | null>(null);
  const [coinAmount, setCoinAmount] = useState<string>("100");
  const [spinRotation, setSpinRotation] = useState(0);
  const [winnerOverlay, setWinnerOverlay] = useState<{ winnerId?: string; username?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [r, u, dep] = await Promise.all([
      fetch("/api/games/jackpot/current-round").then((x) => x.json()),
      apiFetch("/api/auth/me").then(async (x) => (x.ok ? ((await x.json()) as Me) : null)),
      apiFetch("/api/inventory/deposited").then((x) => (x.ok ? x.json() : { items: [] })),
    ]);
    setRound(r.round ?? null);
    setMe(u);
    setSiteItems(dep.items ?? []);
    if (r.round?.endsAt) {
      const ms = new Date(r.round.endsAt).getTime() - Date.now();
      setRemain(ms > 0 ? Math.floor(ms / 1000) : 0);
    } else setRemain(null);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    const c = setInterval(() => {
      setRemain((x) => (x !== null && x > 0 ? x - 1 : x));
    }, 1000);
    const s = getSocket();
    const onWin = (p: { winnerId?: string }) => {
      if (me?.id && p.winnerId === me.id) void confetti({ particleCount: 200, spread: 80, origin: { y: 0.55 } });
      setWinnerOverlay({ winnerId: p.winnerId, username: p.winnerId?.slice(0, 8) });
      setSpinRotation((r) => r + 360 * 5);
      void refresh();
    };
    s.on("jackpot:winner_selected", onWin);
    return () => {
      clearInterval(t);
      clearInterval(c);
      s.off("jackpot:winner_selected", onWin);
    };
  }, [refresh, me?.id]);

  async function deposit() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    const ids = [...selected];
    if (ids.length === 0) {
      setErr("Select items to add to the pot.");
      setBusy(false);
      return;
    }
    try {
      const res = await apiFetch("/api/games/jackpot/deposit", {
        method: "POST",
        body: JSON.stringify({ userItemIds: ids }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Deposit failed");
        return;
      }
      setMsg("Deposited into jackpot.");
      setSelected(new Set());
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function depositCoins() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    const n = Number(coinAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid coin amount.");
      setBusy(false);
      return;
    }
    try {
      const res = await apiFetch("/api/games/jackpot/deposit-coins", {
        method: "POST",
        body: JSON.stringify({ coinAmount: n }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Deposit failed");
        return;
      }
      setMsg("Coins added to jackpot.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const stakeItems = siteItems.filter((i) => i.status === "deposited");

  const segments = useMemo((): (JackpotWheelSegment & { chance: number; valueCoins: number })[] => {
    if (!round || round.entries.length === 0) return [];
    return round.entries.map((e, i) => ({
      userId: e.userId,
      username: e.username,
      chance: e.chance,
      valueCoins: e.valueCoins,
      color: COLORS[i % COLORS.length],
      pct: e.chance * 100,
    }));
  }, [round]);

  const coneStops = useMemo(() => {
    let acc = 0;
    return segments
      .map((s) => {
        const start = acc;
        acc += s.pct;
        return `${s.color} ${start}% ${acc}%`;
      })
      .join(", ");
  }, [segments]);

  const timerPct = remain !== null ? Math.min(100, (remain / 120) * 100) : 0;

  return (
    <div className="space-y-8">
      <BloxyPageHeader
        title="Jackpot"
        subtitle="Weighted spin wheel — your ◈ share sets slice size. Winner takes the pot; provably fair seed commitment after each round."
        eyebrow="Bloxy games"
      >
        <a
          href="#join-pot"
          className="rounded-xl bg-accent-cyan px-5 py-2.5 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110"
        >
          Join pot
        </a>
      </BloxyPageHeader>

      {msg && (
        <p className="rounded-xl border border-accent-cyan/25 bg-accent-cyan/10 px-4 py-3 text-sm text-accent-cyan">{msg}</p>
      )}
      {err && (
        <p className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">{err}</p>
      )}

      {round?.endsAt && (
        <div className="h-2 w-full overflow-hidden rounded-full border border-border-default bg-bg-tertiary">
          <motion.div
            className="h-full bg-gradient-to-r from-accent-cyan to-accent-blue"
            animate={{ width: `${Math.max(5, 100 - timerPct)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,300px)]">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-default bg-bg-secondary/80 p-6 shadow-card sm:p-10">
          <JackpotSpinWheel
            segments={segments}
            coneStops={coneStops}
            totalValue={round?.totalValue ?? 0}
            remain={remain}
            spinRotation={spinRotation}
            serverSeedHash={round?.serverSeedHash ?? null}
          />
        </div>

        <div className="flex flex-col rounded-2xl border border-border-default bg-bg-secondary/90 shadow-card">
          <div className="border-b border-border-default px-4 py-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-text-primary">Players</h3>
            <p className="text-[11px] text-text-muted">{segments.length} in this round</p>
          </div>
          <ul className="max-h-[min(420px,50vh)] flex-1 space-y-2 overflow-y-auto p-3">
            {segments.map((e, i) => (
              <li
                key={`${e.userId}-${i}`}
                className="flex items-center justify-between rounded-xl bg-bg-tertiary/70 px-3 py-2.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/10" style={{ background: e.color }} />
                  <span className="truncate font-medium text-text-primary">{e.username}</span>
                  {me?.id === e.userId && <span className="shrink-0 text-accent-cyan">(you)</span>}
                </span>
                <span className="shrink-0 font-display tabular-nums text-text-secondary">
                  {e.pct.toFixed(1)}% · ◈{formatCoins(e.valueCoins)}
                </span>
              </li>
            ))}
            {segments.length === 0 && (
              <li className="py-8 text-center text-sm text-text-secondary">No entries yet — be first.</li>
            )}
          </ul>
          {me && (
            <div className="border-t border-border-default p-3">
              <a
                href="#join-pot"
                className="flex w-full items-center justify-center rounded-xl bg-accent-cyan py-3 text-center text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110"
              >
                JOIN
              </a>
            </div>
          )}
        </div>
      </div>

      {me && (
        <section id="join-pot" className="scroll-mt-24 rounded-2xl border border-border-default bg-bg-tertiary/60 p-5 shadow-card">
          <h2 className="font-semibold text-text-primary">Deposit site coins</h2>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              Amount
              <input
                type="number"
                min={1}
                disabled={busy}
                className="ml-2 w-28 rounded-lg border border-border-default bg-bg-primary px-2 py-1 text-text-primary"
                value={coinAmount}
                onChange={(e) => setCoinAmount(e.target.value)}
              />
            </label>
            <AsyncButton
              disabled={busy}
              className="rounded-xl bg-accent-cyan px-4 py-2 text-sm font-bold text-[#0a0e14] shadow-glow-cyan"
              onClickAsync={depositCoins}
            >
              Deposit coins
            </AsyncButton>
          </div>
          <p className="mt-2 text-xs text-text-secondary">Balance: ◈ {Math.round(me.balanceCoins ?? 0).toLocaleString()}</p>
        </section>
      )}

      {me && stakeItems.length > 0 && (
        <section className="rounded-2xl border border-border-default bg-bg-tertiary/60 p-5 shadow-card">
          <h2 className="font-semibold text-text-primary">Deposit items</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {stakeItems.map((it) => (
              <button
                key={it.id}
                type="button"
                disabled={busy}
                onClick={() =>
                  setSelected((p) => {
                    const n = new Set(p);
                    if (n.has(it.id)) n.delete(it.id);
                    else n.add(it.id);
                    return n;
                  })
                }
                className={`rounded-lg border px-3 py-2 text-left text-xs ${
                  selected.has(it.id) ? "border-accent-cyan bg-accent-cyan/10" : "border-border-default bg-bg-secondary"
                }`}
              >
                {it.itemName} · ◈{it.valueCoins}
              </button>
            ))}
          </div>
          <AsyncButton
            disabled={busy}
            className="mt-3 rounded-xl bg-accent-cyan px-4 py-2 text-sm font-bold text-[#0a0e14] shadow-glow-cyan"
            onClickAsync={deposit}
          >
            Deposit selected
          </AsyncButton>
        </section>
      )}

      {!me && (
        <p className="rounded-2xl border border-dashed border-border-default bg-bg-secondary/50 px-4 py-6 text-center text-text-secondary">
          <a href="/login" className="font-bold text-accent-cyan underline hover:no-underline">
            Log in
          </a>{" "}
          to join the jackpot.
        </p>
      )}

      <AnimatePresence>
        {winnerOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/85 p-6"
            onClick={() => setWinnerOverlay(null)}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center">
              <p className="font-display text-2xl font-bold text-accent-gold">Winner</p>
              <p className="mt-2 text-xl text-text-primary">{winnerOverlay.username ?? winnerOverlay.winnerId}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
