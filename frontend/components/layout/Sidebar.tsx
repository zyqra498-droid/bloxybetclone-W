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

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/coinflip", label: "Coinflip", icon: "🎲" },
  { href: "/jackpot", label: "Jackpot", icon: "🎰" },
  { href: "/case-battles", label: "Upgrade", icon: "⬆" },
  { href: "/market", label: "Marketplace", icon: "◈" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/provably-fair", label: "FAQ", icon: "❓" },
  { href: "/wallet", label: "Live Support", icon: "💬" },
  { href: "/wallet", label: "Redeem", icon: "🎟" },
];

function NavLink({
  href,
  label,
  icon,
  collapsed,
}: {
  href: string;
  label: string;
  icon: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));

  const inner = (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg border-l-2 py-2.5 text-sm font-medium transition ${
        collapsed ? "justify-center border-transparent px-2" : "pl-2 pr-2"
      } ${
        active
          ? "border-accent-cyan bg-accent-cyan/10 text-text-primary shadow-[inset_0_0_12px_rgba(45,212,191,0.08)]"
          : "border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      } ${active && collapsed ? "bg-accent-cyan/10" : ""}`}
    >
      <span className={`flex w-8 shrink-0 justify-center text-lg ${active ? "" : "opacity-80"}`} aria-hidden>
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{inner}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={6}
            className="z-[200] rounded-btn border border-border-default bg-bg-tertiary px-2 py-1 text-xs text-text-primary shadow-card"
          >
            {label}
            <Tooltip.Arrow className="fill-bg-tertiary" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return inner;
}

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
    return () => {
      s.off("user:balance", onBalance);
    };
  }, [me?.id]);

  const displayBalance = liveBalance ?? (me ? Math.round(me.balanceCoins) : 0);

  return (
    <Tooltip.Provider delayDuration={200}>
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-[100dvh] shrink-0 flex-col border-r border-border-default bg-bg-secondary transition-all duration-300 ease-in-out md:flex`}
        style={{ width: sidebarWidthPx }}
      >
      <div className="flex items-center gap-2 border-b border-border-default px-2 py-3">
        <Link
          href="/"
          className={`group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-bg-hover ${collapsed ? "justify-center" : ""}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-cyan/25 to-accent-blue/10 font-display text-lg font-bold text-accent-cyan shadow-glow-cyan ring-1 ring-accent-cyan/30 transition group-hover:animate-pulse">
            R
          </span>
          {!collapsed && (
            <span className="font-display text-lg font-bold tracking-tight text-text-primary">
              Roblox<span className="text-accent-cyan">Bet</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pt-3">
        {NAV.map((n, i) => (
          <NavLink key={`${n.href}-${n.label}-${i}`} href={n.href} label={n.label} icon={n.icon} collapsed={collapsed} />
        ))}
        {!collapsed && (
          <Link
            href="/leaderboard"
            className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-accent-cyan/30 py-2.5 pl-2 pr-2 text-sm font-semibold text-accent-cyan/90 transition hover:bg-accent-cyan/10"
          >
            <span className="flex w-8 justify-center text-lg" aria-hidden>
              ✨
            </span>
            RobloxBet+
          </Link>
        )}
      </nav>

      <div className="mt-auto border-t border-border-default p-2">
        {!collapsed && (
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-text-muted">
            <Link href="/market" className="transition hover:text-accent-cyan">
              Affiliate
            </Link>
            <Link href="/provably-fair" className="transition hover:text-accent-cyan">
              Provably Fair
            </Link>
            <span className="cursor-default opacity-60">Terms</span>
          </div>
        )}
        {!collapsed && (
          <div className="mb-2 flex gap-2 px-1">
            {["𝕏", "✈", "▶"].map((sym) => (
              <span
                key={sym}
                className="flex h-8 w-8 cursor-default items-center justify-center rounded-lg border border-border-default bg-bg-tertiary text-xs text-text-secondary"
                aria-hidden
              >
                {sym}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mb-2 flex h-9 w-full items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span
            className={`inline-block text-lg transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
            aria-hidden
          >
            ⟨
          </span>
        </button>

        {me && !isLoading ? (
          <Link
            href={profileHref}
            className={`flex items-center gap-2 rounded-lg bg-bg-tertiary/80 p-2 ${collapsed ? "justify-center" : ""}`}
          >
            {me.avatarUrl ? (
              <Image
                src={me.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="shrink-0 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-hover text-sm text-text-primary">
                {(me.displayName || me.username).slice(0, 1)}
              </span>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{me.displayName || me.username}</p>
                <p className="flex items-center gap-0.5 font-display text-xs text-accent-gold">
                  ◈ <CountUp value={displayBalance} duration={0.4} />
                </p>
              </div>
            )}
          </Link>
        ) : !me && !isLoading ? (
          <Link
            href="/login"
            className="block rounded-lg px-3 py-2 text-center text-sm text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            Log in
          </Link>
        ) : null}
      </div>
      </aside>
    </Tooltip.Provider>
  );
}
