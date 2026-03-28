"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarLayout } from "@/contexts/SidebarLayoutContext";
import { getSocket } from "@/lib/socket";
import { CountUp } from "@/components/ui/CountUp";
import type { Me } from "@/lib/types";

/* ─── Icons (inline SVGs — no emoji, matches BloxyBet style) ─── */
const Icons = {
  home: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7A1 1 0 0 0 3 11h1v6a1 1 0 0 0 1 1h4v-4h2v4h4a1 1 0 0 0 1-1v-6h1a1 1 0 0 0 .707-1.707l-7-7z" />
    </svg>
  ),
  coinflip: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <text x="10" y="14" textAnchor="middle" fontSize="10" fill="currentColor">H</text>
    </svg>
  ),
  jackpot: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 0 0 .95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 0 0-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 0 0-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 0 0-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 0 0 .951-.69l1.519-4.674z" />
    </svg>
  ),
  upgrade: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path fillRule="evenodd" d="M3.293 9.707a1 1 0 0 1 0-1.414l6-6a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1-1.414 1.414L11 5.414V17a1 1 0 1 1-2 0V5.414L4.707 9.707a1 1 0 0 1-1.414 0z" clipRule="evenodd" />
    </svg>
  ),
  market: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M3 1a1 1 0 0 0 0 2h1.22l.305 1.222a.997.997 0 0 0 .01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 0 0 0-2H6.414l1-1H14a1 1 0 0 0 .894-.553l3-6A1 1 0 0 0 17 3H6.28l-.31-1.243A1 1 0 0 0 5 1H3z" />
    </svg>
  ),
  leaderboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
    </svg>
  ),
  race: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm1-12a1 1 0 1 0-2 0v4a1 1 0 0 0 .293.707l2.828 2.829a1 1 0 1 0 1.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  ),
  faq: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-3a1 1 0 0 0-.867.5 1 1 0 1 1-1.731-1A3 3 0 0 1 13 8a3.001 3.001 0 0 1-2 2.83V11a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1 1 1 0 1 0 0-2zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 0 1-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
    </svg>
  ),
  redeem: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path fillRule="evenodd" d="M5 5a3 3 0 0 1 5-2.236A3 3 0 0 1 14.83 6H16a2 2 0 1 1 0 4h-5V9a1 1 0 1 0-2 0v1H4a2 2 0 1 1 0-4h1.17A3 3 0 0 1 5 5zm4 1a1 1 0 1 0-1 1 1 0 0 0 1-1zm5 0a1 1 0 1 0-1 1 1 0 0 0 1-1z" clipRule="evenodd" />
      <path d="M9 11H3v5a2 2 0 0 0 2 2h4v-7zm2 7h4a2 2 0 0 0 2-2v-5h-6v7z" />
    </svg>
  ),
  vip: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0z" clipRule="evenodd" />
    </svg>
  ),
};

/* ─── Nav config — matches BloxyBet exactly ─── */
const NAV_MAIN = [
  { href: "/",            label: "Home",        icon: Icons.home },
  { href: "/coinflip",    label: "Coinflip",    icon: Icons.coinflip },
  { href: "/jackpot",     label: "Jackpot",     icon: Icons.jackpot },
  { href: "/case-battles",label: "Upgrade",     icon: Icons.upgrade,   soon: true },
];

const NAV_SECONDARY = [
  { href: "/market",      label: "Marketplace", icon: Icons.market },
  { href: "/leaderboard", label: "Leaderboard", icon: Icons.leaderboard },
  { href: "/race",        label: "Race",        icon: Icons.race,      soon: true },
];

const NAV_TERTIARY = [
  { href: "/faq",         label: "FAQ",         icon: Icons.faq,       soon: true },
  { href: "/support",     label: "Live Support", icon: Icons.support,  soon: true },
];

const NAV_BOTTOM = [
  { href: "/redeem",      label: "Redeem",      icon: Icons.redeem,    soon: true },
  { href: "/vip",         label: "BloxyVIP+",   icon: Icons.vip,       soon: true },
];

const FOOTER_LINKS = [
  { label: "Affiliate",     href: "/affiliate" },
  { label: "Provably Fair", href: "/provably-fair" },
  { label: "Terms of Service", href: "/terms" },
];

/* ─── Single nav link ─── */
function NavLink({
  href,
  label,
  icon,
  collapsed,
  soon = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  soon?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));

  const inner = (
    <Link
      href={soon ? "#" : href}
      onClick={soon ? (e) => e.preventDefault() : undefined}
      className={[
        "nav-item group",
        active ? "active" : "",
        soon ? "cursor-not-allowed opacity-40" : "",
        collapsed ? "justify-center px-0 mx-2" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="nav-icon flex-shrink-0">{icon}</span>

      {!collapsed && (
        <>
          <span className="flex-1 truncate text-sm">{label}</span>
          {soon && (
            <span className="ml-auto rounded-full bg-accent-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-gold">
              Soon
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{inner}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={8}
            className="z-[200] rounded-lg border border-border-default bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-card"
          >
            {label}
            {soon && <span className="ml-1 text-accent-gold">(Soon)</span>}
            <Tooltip.Arrow className="fill-bg-card" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return inner;
}

/* ─── Divider ─── */
function NavDivider() {
  return <div className="mx-3 my-1.5 h-px bg-border-default" />;
}

/* ─── Main Sidebar ─── */
export function Sidebar({ me, isLoading }: { me: Me | null; isLoading: boolean }) {
  const { collapsed, toggleCollapsed, sidebarWidthPx } = useSidebarLayout();
  const profileHref = me ? `/profile/${encodeURIComponent(me.username)}` : "/login";
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  useEffect(() => {
    if (me) setLiveBalance(Math.round(me.balanceCoins));
  }, [me?.balanceCoins, me?.id]);

  useEffect(() => {
    if (!me?.id) return;
    const s = getSocket();
    const onBalance = (p: unknown) => {
      if (typeof p === "object" && p !== null && "balanceCoins" in p) {
        const v = (p as { balanceCoins: unknown }).balanceCoins;
        if (typeof v === "number" && Number.isFinite(v)) setLiveBalance(Math.round(v));
      }
    };
    s.on("user:balance", onBalance);
    return () => { s.off("user:balance", onBalance); };
  }, [me?.id]);

  const displayBalance = liveBalance ?? (me ? Math.round(me.balanceCoins) : 0);

  return (
    <Tooltip.Provider delayDuration={150}>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-[100dvh] flex-col border-r border-border-default bg-bg-sidebar transition-all duration-300 ease-in-out md:flex"
        style={{ width: sidebarWidthPx }}
      >
        {/* ── Logo ── */}
        <div className={`flex h-14 shrink-0 items-center border-b border-border-default ${collapsed ? "justify-center px-2" : "px-4"}`}>
          <Link
            href="/"
            className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}
          >
            {/* Logo mark */}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue/30 to-accent-blue/10 ring-1 ring-accent-blue/40">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent-blue" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            {!collapsed && (
              <span className="font-display text-lg font-bold tracking-tight text-text-primary">
                Roblox<span className="text-accent-blue">Bet</span>
              </span>
            )}
          </Link>
        </div>

        {/* ── Nav ── */}
        <nav className="no-scrollbar flex flex-1 flex-col overflow-y-auto py-2">
          {/* Group 1 */}
          <div className="flex flex-col gap-0.5">
            {NAV_MAIN.map((n) => (
              <NavLink key={n.href + n.label} {...n} collapsed={collapsed} />
            ))}
          </div>

          <NavDivider />

          {/* Group 2 */}
          <div className="flex flex-col gap-0.5">
            {NAV_SECONDARY.map((n) => (
              <NavLink key={n.href + n.label} {...n} collapsed={collapsed} />
            ))}
          </div>

          <NavDivider />

          {/* Group 3 */}
          <div className="flex flex-col gap-0.5">
            {NAV_TERTIARY.map((n) => (
              <NavLink key={n.href + n.label} {...n} collapsed={collapsed} />
            ))}
          </div>

          <NavDivider />

          {/* Group 4 — bottom nav items */}
          <div className="flex flex-col gap-0.5">
            {NAV_BOTTOM.map((n) => (
              <NavLink key={n.href + n.label} {...n} collapsed={collapsed} />
            ))}
          </div>

          {/* Footer links — only when expanded */}
          {!collapsed && (
            <>
              <NavDivider />
              <div className="flex flex-col gap-0.5 px-3">
                {FOOTER_LINKS.map((f) => (
                  <Link
                    key={f.href}
                    href={f.href}
                    className="py-1 text-xs text-text-muted transition hover:text-text-secondary"
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </nav>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-border-default p-2">
          {/* Social icons */}
          {!collapsed && (
            <div className="mb-3 flex items-center gap-2 px-1">
              {[
                { label: "X / Twitter", symbol: "𝕏" },
                { label: "Telegram",    symbol: "✈" },
                { label: "YouTube",     symbol: "▶" },
                { label: "Discord",     symbol: "◉" },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  aria-label={s.label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-bg-card text-xs text-text-muted transition hover:border-border-hover hover:text-text-secondary"
                >
                  {s.symbol}
                </button>
              ))}
            </div>
          )}

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mb-2 flex h-8 w-full items-center justify-center rounded-lg border border-border-default bg-bg-card text-text-muted transition hover:border-border-hover hover:text-text-primary"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span
              className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
            >
              {Icons.chevronLeft}
            </span>
          </button>

          {/* User profile */}
          {me && !isLoading ? (
            <Link
              href={profileHref}
              className={`flex items-center gap-2.5 rounded-lg bg-bg-card p-2 transition hover:bg-bg-card-hover ${collapsed ? "justify-center" : ""}`}
            >
              {me.avatarUrl ? (
                <Image
                  src={me.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-accent-blue/30"
                  unoptimized
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-card-hover text-sm font-bold text-text-primary ring-1 ring-border-default">
                  {(me.displayName || me.username).slice(0, 1).toUpperCase()}
                </span>
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {me.displayName || me.username}
                  </p>
                  <p className="flex items-center gap-1 font-display text-xs font-semibold text-accent-green">
                    <span>◆</span>
                    <CountUp value={displayBalance} duration={0.4} />
                  </p>
                </div>
              )}
            </Link>
          ) : !me && !isLoading ? (
            <Link
              href="/login"
              className="block rounded-lg py-2 text-center text-sm font-medium text-text-secondary transition hover:bg-bg-card hover:text-text-primary"
            >
              {collapsed ? "→" : "Log in"}
            </Link>
          ) : null}
        </div>
      </aside>
    </Tooltip.Provider>
  );
}
