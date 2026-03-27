"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSocket } from "@/lib/socket";

function tabClass(active: boolean) {
  return `flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-semibold transition-colors ${
    active ? "text-accent-cyan" : "text-text-secondary"
  }`;
}

const DEMO_CHAT = [
  { id: "1", user: "Rowan", time: "12:04", text: "Anyone hitting coinflip tonight?" },
  { id: "2", user: "Maya", time: "12:06", text: "Pot looking huge — GL everyone" },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { user: me } = useAuth();
  const [gamesOpen, setGamesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [feed, setFeed] = useState(DEMO_CHAT);

  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const s = getSocket();
    const onAct = (p: { message?: string }) => {
      const m = p?.message?.trim();
      if (!m) return;
      setFeed((f) => [{ id: crypto.randomUUID(), user: "Live", time: tick(), text: m.slice(0, 200) }, ...f].slice(0, 20));
    };
    s.on("activity:new", onAct);
    return () => s.off("activity:new", onAct);
  }, []);

  const homeActive = pathname === "/";
  const gamesActive = pathname.startsWith("/coinflip") || pathname.startsWith("/jackpot") || pathname.startsWith("/market");

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-stretch border-t border-border-default bg-bg-secondary pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <Link href="/" className={tabClass(homeActive)} aria-current={homeActive ? "page" : undefined}>
          <span className="text-xl" aria-hidden>
            ⌂
          </span>
          Home
        </Link>

        <button
          type="button"
          className={tabClass(gamesActive)}
          aria-expanded={gamesOpen}
          aria-haspopup="dialog"
          onClick={() => setGamesOpen(true)}
        >
          <span className="text-xl" aria-hidden>
            🎮
          </span>
          Games
        </button>

        <button
          type="button"
          className={tabClass(chatOpen)}
          aria-expanded={chatOpen}
          aria-haspopup="dialog"
          onClick={() => setChatOpen(true)}
        >
          <span className="text-xl" aria-hidden>
            💬
          </span>
          Chat
        </button>
      </nav>

      <Dialog.Root open={gamesOpen} onOpenChange={setGamesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm md:hidden" />
          <Dialog.Content className="fixed bottom-0 left-0 right-0 z-[91] max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-border-default border-b-0 bg-bg-secondary px-4 pb-6 pt-3 shadow-card focus:outline-none md:hidden">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-default" aria-hidden />
            <Dialog.Title className="mb-3 font-display text-base font-bold text-text-primary">Games</Dialog.Title>
            <Dialog.Description className="sr-only">Open Coinflip, Jackpot, or Market</Dialog.Description>
            <div className="flex flex-col gap-2">
              <Dialog.Close asChild>
                <Link
                  href="/coinflip"
                  className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-3 text-left text-sm font-semibold text-text-primary transition hover:border-accent-cyan/30 hover:bg-bg-hover"
                >
                  🎲 Coinflip
                </Link>
              </Dialog.Close>
              <Dialog.Close asChild>
                <Link
                  href="/jackpot"
                  className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-3 text-left text-sm font-semibold text-text-primary transition hover:border-accent-cyan/30 hover:bg-bg-hover"
                >
                  🎰 Jackpot
                </Link>
              </Dialog.Close>
              <Dialog.Close asChild>
                <Link
                  href="/market"
                  className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-3 text-left text-sm font-semibold text-text-primary transition hover:border-accent-cyan/30 hover:bg-bg-hover"
                >
                  ◈ Marketplace
                </Link>
              </Dialog.Close>
              <Dialog.Close asChild>
                <Link
                  href="/wallet"
                  className="rounded-xl border border-accent-cyan/25 bg-accent-cyan/10 px-4 py-3 text-left text-sm font-semibold text-accent-cyan transition hover:bg-accent-cyan/15"
                >
                  👛 Wallet · deposits & withdrawals
                </Link>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={chatOpen} onOpenChange={setChatOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm md:hidden" />
          <Dialog.Content className="fixed bottom-0 left-0 right-0 z-[91] flex max-h-[78dvh] flex-col rounded-t-2xl border border-border-default border-b-0 bg-bg-secondary focus:outline-none md:hidden">
            <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border-default" aria-hidden />
            <Dialog.Title className="border-b border-border-default px-4 pb-3 pt-2 font-display text-base font-bold text-text-primary">
              Online Chat
            </Dialog.Title>
            <Dialog.Description className="sr-only">Community chat preview</Dialog.Description>
            <ul className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {feed.map((row) => (
                <li key={row.id} className="rounded-xl bg-bg-tertiary/60 px-3 py-2">
                  <div className="flex justify-between gap-2 text-xs font-semibold text-text-primary">
                    <span>{row.user}</span>
                    <span className="text-text-muted">{row.time}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">{row.text}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border-default p-4">
              <p className="text-center text-xs text-text-muted">{me ? "Full chat on desktop (right rail)." : "Log in to participate."}</p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
