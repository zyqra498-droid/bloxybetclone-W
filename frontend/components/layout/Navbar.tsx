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

const TAGLINE = "RobloxBet — 0% friction limiteds · provably fair coinflip, jackpot & market.";

function NavLogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-cyan/25 via-bg-tertiary to-accent-blue/20 shadow-glow-cyan ring-1 ring-accent-cyan/40 ${className}`}
    >
      <svg viewBox="0 0 32 32" className="h-5 w-5 text-accent-cyan" fill="none" aria-hidden>
        <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
        <ellipse cx="16" cy="16" rx="10" ry="4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <circle cx="11" cy="14" r="2" fill="currentColor" opacity="0.35" />
      </svg>
    </span>
  );
}

function GiveawayStrip() {
  const [left, setLeft] = useState({ h: 1, m: 21, s: 12 });

  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((p) => {
        let { h, m, s } = p;
        s -= 1;
        if (s < 0) {
          s = 59;
          m -= 1;
        }
        if (m < 0) {
          m = 59;
          h -= 1;
        }
        if (h < 0) return { h: 1, m: 21, s: 12 };
        return { h, m, s };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hidden max-w-[min(100%,280px)] items-center gap-2 rounded-pill border border-border-default bg-bg-tertiary px-3 py-1.5 md:flex">
      <span aria-hidden>🎁</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Giveaway Now!</span>
      <span className="font-display text-xs font-bold tabular-nums text-accent-cyan">
        {left.h} : {String(left.m).padStart(2, "0")} : {String(left.s).padStart(2, "0")}
      </span>
    </div>
  );
}

function NavbarBalanceChip({ value }: { value: number }) {
  const prev = useRef(value);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (value > prev.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 700);
      prev.current = value;
      return () => window.clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border border-border-default bg-bg-tertiary/90 px-3 py-1 font-display text-sm font-bold text-text-primary transition-shadow duration-300 ${
        pulse ? "shadow-glow-cyan" : ""
      }`}
    >
      <span className="text-accent-cyan" aria-hidden>
        ◈
      </span>
      <CountUp value={value} duration={0.55} />
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { user: me, isLoading, logout } = useAuth();
  const { sidebarWidthPx } = useSidebarLayout();
  const isMd = useMediaMd();
  const leftOffset = isMd ? sidebarWidthPx : 0;

  const { push: toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifPreview, setNotifPreview] = useState<{ id: string; title: string; body: string; read: boolean }[]>([]);
  const [ticker, setTicker] = useState<{ id: string; text: string }[]>([]);
  const [tickIndex, setTickIndex] = useState(0);
  const [tickerPaused, setTickerPaused] = useState(false);

  const loadNotifs = useCallback(() => {
    apiFetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n = d?.notifications as { id: string; title: string; body: string; read: boolean }[] | undefined;
        if (n) {
          setNotifPreview(n.slice(0, 5));
          setNotifCount(n.filter((x) => !x.read).length);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifs();
  }, [pathname, me?.id, loadNotifs]);

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
    s.on("activity:new", onActivity);
    s.on("notification:new", onNotif);
    s.on("jackpot:winner_selected", loadNotifs);
    s.on("coinflip:game_result", loadNotifs);
    return () => {
      s.off("activity:new", onActivity);
      s.off("notification:new", onNotif);
      s.off("jackpot:winner_selected", loadNotifs);
      s.off("coinflip:game_result", loadNotifs);
    };
  }, [toast, loadNotifs]);

  useEffect(() => {
    if (ticker.length <= 1) return;
    if (tickerPaused) return;
    const id = window.setInterval(() => {
      setTickIndex((i) => (i + 1) % ticker.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [ticker.length, tickerPaused]);

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
      className="fixed top-0 right-0 z-30 flex h-14 items-center border-b border-border-default bg-bg-primary/92 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl"
      style={{ left: leftOffset }}
    >
      <div className="flex h-full w-full min-w-0 items-center gap-1 px-2 sm:gap-2 sm:px-3 md:px-4">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-xl py-1 pl-0.5 pr-1.5 transition hover:bg-bg-hover/60 sm:pr-2 md:hidden"
          >
            <NavLogoMark className="transition group-hover:scale-105" />
            <span className="font-display text-base font-bold tracking-tight text-text-primary">
              Roblox<span className="text-accent-cyan">Bet</span>
            </span>
          </Link>
          <GiveawayStrip />
        </div>

        <div
          className="relative mx-0 hidden min-h-[34px] min-w-0 flex-1 overflow-hidden rounded-pill border border-border-default bg-bg-secondary/85 px-2 py-1.5 shadow-inner md:mx-1 md:flex md:px-3"
          onMouseEnter={() => setTickerPaused(true)}
          onMouseLeave={() => setTickerPaused(false)}
        >
          <div
            className={`whitespace-nowrap text-center text-[11px] text-text-secondary sm:text-xs md:text-sm ${tickerPaused ? "[animation-play-state:paused]" : "animate-ticker"}`}
            title={displayLine}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={displayLine}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="inline-block px-2"
              >
                {displayLine}
              </motion.span>
            </AnimatePresence>
            {ticker.length > 0 && (
              <span className="pointer-events-none inline-block w-8" aria-hidden>
                {" "}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {me && (
            <div className="relative">
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-lg text-text-secondary transition hover:bg-bg-hover"
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  loadNotifs();
                }}
              >
                🔔
                {notifCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 mt-2 w-80 rounded-card border border-border-default bg-bg-secondary py-2 shadow-card"
                  >
                    <div className="border-b border-border-default px-3 pb-2 text-xs font-semibold text-text-secondary">
                      Notifications
                    </div>
                    <ul className="max-h-72 overflow-y-auto">
                      {notifPreview.map((n) => (
                        <li key={n.id} className="border-b border-border-default/50 px-3 py-2 text-sm last:border-0">
                          <p className="font-medium text-text-primary">{n.title}</p>
                          <p className="text-xs text-text-secondary">{n.body}</p>
                        </li>
                      ))}
                      {notifPreview.length === 0 && (
                        <li className="px-3 py-4 text-center text-xs text-text-secondary">No notifications yet</li>
                      )}
                    </ul>
                    <Link
                      href="/notifications"
                      className="block px-3 py-2 text-center text-xs text-accent-cyan hover:underline"
                      onClick={() => setNotifOpen(false)}
                    >
                      View all notifications
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {me && !isLoading && <NavbarBalanceChip value={Math.round(me.balanceCoins)} />}

          {me && !isLoading && (
            <Link
              href="/wallet"
              className="hidden items-center gap-1.5 rounded-xl bg-accent-cyan px-3 py-2 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110 active:scale-[0.98] sm:inline-flex"
            >
              <span aria-hidden>👛</span>
              Wallet
            </Link>
          )}

          {me ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-10 items-center gap-2 rounded-pill border border-border-default bg-bg-tertiary py-1 pl-1 pr-3"
              >
                {me.avatarUrl ? (
                  <Image
                    src={me.avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-hover text-xs text-text-primary">
                    {(me.displayName || me.username).slice(0, 1)}
                  </span>
                )}
                <span className="hidden max-w-[100px] truncate text-sm font-medium text-text-primary lg:inline">
                  {me.displayName || me.username}
                </span>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 mt-2 w-56 rounded-card border border-border-default bg-bg-secondary py-1 shadow-card"
                  >
                    <Link
                      href={profileHref}
                      className="block px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
                      onClick={() => setMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link href="/wallet" className="block px-3 py-2 text-sm text-text-primary hover:bg-bg-hover" onClick={() => setMenuOpen(false)}>
                      Wallet
                    </Link>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-hover"
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
                className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl bg-accent-cyan px-4 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <span aria-hidden className="text-base opacity-90">
                  ⎋
                </span>
                Login
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
