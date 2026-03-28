"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarLayout } from "@/contexts/SidebarLayoutContext";
import { apiFetch } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useToast } from "@/contexts/ToastContext";
import { CountUp } from "@/components/ui/CountUp";
import { useMediaMd } from "@/hooks/useMediaMd";

const TAGLINE = "RobloxBet — Provably fair coinflip, jackpot & Roblox Limiteds market.";

/* ─── Giveaway countdown strip (centre-left of navbar) ─── */
function GiveawayStrip() {
  const [left, setLeft] = useState({ h: 1, m: 21, s: 12 });

  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((p) => {
        let { h, m, s } = p;
        s -= 1;
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) return { h: 1, m: 21, s: 12 };
        return { h, m, s };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="hidden items-center gap-2 rounded-full border border-border-default bg-bg-card px-3 py-1.5 md:flex">
      <span className="text-sm">🎁</span>
      <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
        Giveaway Now!
      </span>
      <div className="flex items-center gap-0.5 font-display text-sm font-bold text-accent-blue">
        <span className="flex h-6 min-w-[22px] items-center justify-center rounded-md bg-bg-sidebar px-1 tabular-nums">
          {left.h}
        </span>
        <span className="mx-0.5 text-text-muted">:</span>
        <span className="flex h-6 min-w-[22px] items-center justify-center rounded-md bg-bg-sidebar px-1 tabular-nums">
          {pad(left.m)}
        </span>
        <span className="mx-0.5 text-text-muted">:</span>
        <span className="flex h-6 min-w-[22px] items-center justify-center rounded-md bg-bg-sidebar px-1 tabular-nums">
          {pad(left.s)}
        </span>
      </div>
    </div>
  );
}

/* ─── Balance chip with pulse animation on increase ─── */
function BalanceChip({ value }: { value: number }) {
  const prev = useRef(value);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (value > prev.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 800);
      prev.current = value;
      return () => window.clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border bg-bg-card px-3 py-1.5 font-display text-sm font-bold text-text-primary transition-all duration-300 ${
        pulse
          ? "border-accent-green shadow-glow-green"
          : "border-border-default"
      }`}
    >
      {/* Green diamond gem icon */}
      <span className="text-accent-green text-base leading-none">◆</span>
      <CountUp value={value} duration={0.5} />
    </div>
  );
}

/* ─── Notification types ─── */
type Notif = { id: string; title: string; body: string; read: boolean };

/* ─── Main Navbar ─── */
export function Navbar() {
  const pathname = usePathname();
  const { user: me, isLoading, logout } = useAuth();
  const { sidebarWidthPx } = useSidebarLayout();
  const isMd = useMediaMd();
  const leftOffset = isMd ? sidebarWidthPx : 0;
  const { push: toast } = useToast();

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [notifCount,  setNotifCount]  = useState(0);
  const [notifList,   setNotifList]   = useState<Notif[]>([]);
  const [ticker,      setTicker]      = useState<{ id: string; text: string }[]>([]);
  const [tickIndex,   setTickIndex]   = useState(0);
  const [tickPaused,  setTickPaused]  = useState(false);

  /* load notifications */
  const loadNotifs = useCallback(() => {
    apiFetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n = d?.notifications as Notif[] | undefined;
        if (n) {
          setNotifList(n.slice(0, 5));
          setNotifCount(n.filter((x) => !x.read).length);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadNotifs(); }, [pathname, me?.id, loadNotifs]);

  /* sockets */
  useEffect(() => {
    const s = getSocket();
    const onActivity = (p: { message?: string }) => {
      if (p?.message) {
        setTicker((t) => [{ id: crypto.randomUUID(), text: p.message! }, ...t].slice(0, 40));
      }
    };
    const onNotif = (p: { title?: string; body?: string }) => {
      toast({ title: p.title ?? "Notification", body: p.body, kind: "deposit" });
      loadNotifs();
    };
    s.on("activity:new",          onActivity);
    s.on("notification:new",      onNotif);
    s.on("jackpot:winner_selected", loadNotifs);
    s.on("coinflip:game_result",    loadNotifs);
    return () => {
      s.off("activity:new",          onActivity);
      s.off("notification:new",      onNotif);
      s.off("jackpot:winner_selected", loadNotifs);
      s.off("coinflip:game_result",    loadNotifs);
    };
  }, [toast, loadNotifs]);

  /* ticker rotation */
  useEffect(() => {
    if (ticker.length <= 1 || tickPaused) return;
    const id = window.setInterval(() => {
      setTickIndex((i) => (i + 1) % ticker.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [ticker.length, tickPaused]);

  const displayLine = useMemo(() => {
    if (ticker.length === 0) return TAGLINE;
    return ticker[tickIndex % ticker.length]?.text ?? TAGLINE;
  }, [ticker, tickIndex]);

  const profileHref = me ? `/profile/${encodeURIComponent(me.username)}` : "/login";

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  return (
    <header
      className="fixed right-0 top-0 z-30 flex h-14 items-center border-b border-border-default bg-bg-sidebar/95 backdrop-blur-xl"
      style={{ left: leftOffset }}
    >
      <div className="flex h-full w-full items-center gap-2 px-3 md:gap-3 md:px-4">

        {/* Mobile logo (hidden on desktop — sidebar has it) */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 md:hidden"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/20 ring-1 ring-accent-blue/40">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent-blue" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="font-display text-base font-bold text-text-primary">
            Roblox<span className="text-accent-blue">Bet</span>
          </span>
        </Link>

        {/* Giveaway strip */}
        <GiveawayStrip />

        {/* Centre ticker */}
        <div
          className="relative hidden min-w-0 flex-1 overflow-hidden rounded-full border border-border-default bg-bg-card px-4 py-1.5 md:block"
          onMouseEnter={() => setTickPaused(true)}
          onMouseLeave={() => setTickPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={displayLine}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="block truncate text-center text-xs text-text-secondary"
            >
              {displayLine}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Right section */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Balance chip */}
          {me && !isLoading && (
            <BalanceChip value={Math.round(me.balanceCoins)} />
          )}

          {/* Wallet button */}
          {me && !isLoading && (
            <Link
              href="/wallet"
              className="hidden items-center gap-1.5 rounded-lg border border-border-default bg-bg-card px-3 py-1.5 text-sm font-semibold text-text-primary transition hover:border-border-hover hover:bg-bg-card-hover sm:flex"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-accent-blue">
                <path d="M4 4a2 2 0 0 0-2 2v1h16V6a2 2 0 0 0-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM4 13a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm5-1a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H9z" clipRule="evenodd" />
              </svg>
              Wallet
            </Link>
          )}

          {/* Notifications */}
          {me && (
            <div className="relative">
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-bg-card text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                aria-label="Notifications"
                onClick={() => { setNotifOpen((o) => !o); loadNotifs(); }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6zM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3z" />
                </svg>
                {notifCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0,  scale: 1 }}
                    exit={{ opacity: 0, y: -6,    scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 rounded-xl border border-border-default bg-bg-sidebar py-2 shadow-card"
                  >
                    <div className="flex items-center justify-between border-b border-border-default px-3 pb-2">
                      <span className="text-xs font-semibold text-text-secondary">Notifications</span>
                      <button
                        type="button"
                        className="text-xs text-accent-blue hover:underline"
                        onClick={() => setNotifOpen(false)}
                      >
                        Mark all read
                      </button>
                    </div>
                    <ul className="max-h-64 overflow-y-auto">
                      {notifList.map((n) => (
                        <li
                          key={n.id}
                          className={`border-b border-border-default/40 px-3 py-2.5 last:border-0 ${!n.read ? "border-l-2 border-l-accent-blue pl-2.5" : ""}`}
                        >
                          <p className="text-sm font-medium text-text-primary">{n.title}</p>
                          <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{n.body}</p>
                        </li>
                      ))}
                      {notifList.length === 0 && (
                        <li className="px-3 py-6 text-center text-xs text-text-muted">
                          No notifications yet
                        </li>
                      )}
                    </ul>
                    <Link
                      href="/notifications"
                      className="block px-3 pt-2 text-center text-xs font-medium text-accent-blue hover:underline"
                      onClick={() => setNotifOpen(false)}
                    >
                      View all notifications
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* User menu */}
          {me ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 items-center gap-2 rounded-full border border-border-default bg-bg-card py-1 pl-1 pr-3 transition hover:border-border-hover"
              >
                {me.avatarUrl ? (
                  <Image
                    src={me.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-card-hover text-xs font-bold text-text-primary">
                    {(me.displayName || me.username).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[90px] truncate text-sm font-medium text-text-primary lg:inline">
                  @{me.displayName || me.username}
                </span>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-text-muted">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0,  scale: 1 }}
                    exit={{ opacity: 0, y: -6,    scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 rounded-xl border border-border-default bg-bg-sidebar py-1 shadow-card"
                  >
                    {[
                      { label: "Profile",  href: profileHref },
                      { label: "Wallet",   href: "/wallet" },
                      { label: "Settings", href: "/settings" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-3 py-2 text-sm text-text-primary transition hover:bg-bg-card-hover"
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="my-1 h-px bg-border-default" />
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-accent-red transition hover:bg-bg-card-hover"
                      onClick={() => void handleLogout()}
                    >
                      Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            !isLoading && (
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-bold text-bg-base transition hover:brightness-110 active:scale-95"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M3 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-2 0V4H5v12h10v-2a1 1 0 0 1 2 0v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M16.707 10.293a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L13.586 12H7a1 1 0 1 1 0-2h6.586l-1.293-1.293a1 1 0 0 1 1.414-1.414l3 3z" clipRule="evenodd" />
                </svg>
                Login
              </Link>
            )
          )}

          {/* Online Chat button */}
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-lg border border-border-default bg-bg-card px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-border-hover hover:text-text-primary xl:flex"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 0 1-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            Online Chat
          </button>
        </div>
      </div>
    </header>
  );
}
