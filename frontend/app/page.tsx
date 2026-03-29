"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CoinflipRoomRow, type BloxyCoinflipRoom } from "@/components/bloxy/CoinflipRoomRow";
import { getSocket } from "@/lib/socket";
import { formatCoins } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    onlineUsers: 0,
    coinsWageredToday: 0,
    activeGames: 0,
    catalogItemCount: 0,
    catalogTotalValue: 0,
  });
  const [feed, setFeed] = useState<{ id: string; text: string }[]>([]);
  const [rooms, setRooms] = useState<BloxyCoinflipRoom[]>([]);
  const [leaderboard, setLeaderboard] = useState<
    { userId: string; username: string; avatarUrl: string | null; wagered: number; wins: number }[]
  >([]);

  useEffect(() => {
    fetch("/api/stats/home", { credentials: "include" })
      .then((r) => r.json())
      .then((d) =>
        setStats({
          onlineUsers: d.onlineUsers ?? 0,
          coinsWageredToday: d.coinsWageredToday ?? 0,
          activeGames: d.activeGames ?? 0,
          catalogItemCount: d.catalogItemCount ?? 0,
          catalogTotalValue: d.catalogTotalValue ?? 0,
        }),
      )
      .catch(() => {});
    fetch("/api/stats/leaderboard?period=daily", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setLeaderboard((d.rows ?? []).slice(0, 5)))
      .catch(() => {});
    fetch("/api/games/coinflip/rooms", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRooms((d.rooms ?? []).slice(0, 12)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const s = getSocket();
    const onAct = (p: { message?: string }) => {
      const m = p?.message;
      if (m) setFeed((f) => [{ id: crypto.randomUUID(), text: m }, ...f].slice(0, 30));
    };
    const onRoom = () => {
      void fetch("/api/games/coinflip/rooms", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setRooms((d.rooms ?? []).slice(0, 12)))
        .catch(() => {});
    };
    s.on("activity:new", onAct);
    s.on("coinflip:room_created", onRoom);
    s.on("coinflip:game_result", onRoom);
    return () => {
      s.off("activity:new", onAct);
      s.off("coinflip:room_created", onRoom);
      s.off("coinflip:game_result", onRoom);
    };
  }, []);

  const games = [
    { href: "/coinflip", title: "Coinflip", subtitle: "50/50 provably fair rooms", visual: "coinflip" as const },
    { href: "/jackpot", title: "Jackpot", subtitle: "Weighted pot — one winner", visual: "jackpot" as const },
    { href: "/market", title: "Marketplace", subtitle: "Roblox Limiteds · live values", visual: "market" as const },
  ];

  return (
    <div className="space-y-8 pb-6">
      <section className="grid grid-cols-3 divide-x divide-border-default rounded-2xl border border-border-default bg-bg-secondary/80 py-6 shadow-card">
        {[
          { label: "Total Items", value: stats.catalogItemCount.toLocaleString("en-US"), icon: null as string | null },
          {
            label: "Total Value",
            value: formatCoins(Math.round(stats.catalogTotalValue)),
            icon: "◈" as string | null,
          },
          { label: "Active Games", value: String(stats.activeGames), icon: null as string | null },
        ].map((col) => (
          <div key={col.label} className="px-2 text-center sm:px-4">
            <div className="flex items-center justify-center gap-1.5">
              {col.icon && <span className="text-accent-cyan">{col.icon}</span>}
              <p className="font-display text-2xl font-bold tabular-nums text-text-primary sm:text-3xl">{col.value}</p>
            </div>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">{col.label}</p>
          </div>
        ))}
      </section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-border-default bg-gradient-to-br from-bg-secondary via-bg-secondary to-bg-tertiary/90 p-6 shadow-card md:p-8"
      >
        <div className="relative z-[1] flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Welcome offer</p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-text-primary md:text-4xl">
              Fair plays, blue lights, <span className="text-accent-cyan">Roblox limiteds</span>.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-text-secondary">
              Coinflip, jackpot, and marketplace — built for clarity, seeds you can verify, and wallet-backed deposits when your stack is live.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/coinflip"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent-cyan px-6 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110 active:scale-[0.98]"
              >
                Play now
              </Link>
              {!authLoading && !isLoggedIn && (
                <Link
                  href="/login"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-accent-blue/45 bg-accent-blue/15 px-6 text-sm font-bold text-accent-blue shadow-[0_0_20px_rgba(125,211,252,0.12)] transition hover:bg-accent-blue/25 active:scale-[0.98]"
                >
                  Log in with Roblox
                </Link>
              )}
              <Link
                href="/wallet"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border-default bg-bg-tertiary px-6 text-sm font-semibold text-text-primary transition hover:border-accent-cyan/30"
              >
                Wallet
              </Link>
            </div>
          </div>
          <div className="grid w-full max-w-md grid-cols-3 gap-2 sm:gap-3">
            {[
              { k: "Online", v: stats.onlineUsers },
              { k: "Wagered 24h", v: formatCoins(stats.coinsWageredToday) },
              { k: "Open rooms", v: rooms.length },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-border-default bg-bg-primary/40 px-2 py-3 text-center">
                <p className="font-display text-lg font-bold tabular-nums text-accent-cyan sm:text-xl">
                  {typeof s.v === "number" ? s.v.toLocaleString("en-US") : s.v}
                </p>
                <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-text-muted sm:text-[10px]">{s.k}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-pill bg-accent-cyan px-4 py-2 text-sm font-bold text-[#0a0e14] shadow-glow-cyan">Limiteds</span>
          <Link
            href="/coinflip"
            className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-accent-cyan/25"
          >
            History
          </Link>
        </div>
        <Link
          href="/coinflip"
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-accent-cyan px-5 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110 active:scale-[0.98]"
        >
          Create
        </Link>
      </div>

      <div>
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-text-secondary">Live coinflip</h2>
        <div className="mt-3 flex flex-col gap-3">
          {rooms.map((r, i) => (
            <CoinflipRoomRow key={r.id} room={r} meId={undefined} joinHref={`/coinflip?join=${encodeURIComponent(r.id)}`} index={i} />
          ))}
          {rooms.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border-default bg-bg-secondary/40 py-12 text-center text-sm text-text-muted">
              No open rooms — be the first to{" "}
              <Link href="/coinflip" className="font-semibold text-accent-cyan hover:underline">
                create one
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-text-secondary">Bloxy games</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {games.map((g, i) => (
            <motion.div
              key={g.href}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
              whileHover={{ y: -4 }}
              className="group overflow-hidden rounded-2xl border border-border-default bg-bg-secondary/90 shadow-card transition hover:border-accent-cyan/20"
            >
              <Link href={g.href} className="block">
                <div className="relative h-36 overflow-hidden border-b border-border-default md:h-40">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.18),transparent_55%)]" />
                  <div className="absolute inset-0 opacity-40 mix-blend-screen bg-[conic-gradient(from_200deg,rgba(59,130,246,0.15),transparent)]" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-accent-cyan/30 bg-bg-tertiary/90 shadow-glow-cyan">
                    <div className="flex h-full items-center justify-center font-display text-2xl font-bold text-accent-cyan">
                      {g.visual === "coinflip" ? "50" : g.visual === "jackpot" ? "◈" : "⚿"}
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-secondary via-bg-secondary/90 to-transparent px-4 pb-3 pt-10">
                    <h3 className="font-display text-xl font-bold text-text-primary">{g.title}</h3>
                  </div>
                </div>
                <p className="px-4 py-3 text-sm text-text-secondary">{g.subtitle}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border-default bg-bg-secondary/70 p-5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-default pb-3">
            <h3 className="font-display text-base font-bold text-text-primary">Live feed</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Activity</span>
          </div>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
            {feed.map((x, idx) => (
              <motion.li
                key={x.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.18) }}
                className="flex gap-3 rounded-xl border border-border-default bg-bg-tertiary/50 px-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-cyan/15 font-display text-[10px] font-bold text-accent-cyan">
                  {String.fromCharCode(65 + (idx % 26))}
                </div>
                <p className="min-w-0 flex-1 text-xs leading-snug text-text-secondary">{x.text}</p>
              </motion.li>
            ))}
            {feed.length === 0 && (
              <li className="rounded-xl border border-dashed border-border-default py-10 text-center text-sm text-text-muted">
                Waiting for the next update…
              </li>
            )}
          </ul>
        </motion.section>

        <aside className="space-y-4 rounded-2xl border border-border-default bg-bg-secondary/70 p-5">
          <h3 className="font-display text-base font-bold text-text-primary">Top 5 today</h3>
          <ol className="space-y-2">
            {leaderboard.map((r, i) => (
              <li
                key={r.userId}
                className="flex items-center justify-between rounded-xl border border-border-default bg-bg-tertiary/40 px-3 py-2 text-sm"
              >
                <span className="font-display font-bold text-accent-cyan">{i + 1}</span>
                <span className="flex-1 truncate px-2 text-text-primary">{r.username}</span>
                <span className="font-display text-xs font-bold text-accent-gold">{formatCoins(r.wagered)}</span>
              </li>
            ))}
            {leaderboard.length === 0 && <li className="text-sm text-text-muted">No leaderboard data yet.</li>}
          </ol>
          <div className="flex flex-col gap-2 border-t border-border-default pt-4">
            <Link
              href="/leaderboard"
              className="block rounded-xl border border-accent-cyan/25 py-2.5 text-center text-sm font-semibold text-accent-cyan transition hover:bg-accent-cyan/10"
            >
              Full leaderboard
            </Link>
            <Link href="/provably-fair" className="block text-center text-xs text-text-muted hover:text-accent-cyan">
              Provably fair
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
