"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSocket } from "@/lib/socket";

const DEMO_MESSAGES = [
  { id: "1", user: "Rowan", time: "12:04", text: "Anyone hitting coinflip tonight?" },
  { id: "2", user: "Maya", time: "12:06", text: "Pot looking spicy on jackpot 🎰" },
  { id: "3", user: "Alex", time: "12:08", text: "GG on that flip — seeds looked clean" },
];

export function RIGHT_CHAT_RAIL_WIDTH_PX(): number {
  return 300;
}

export function RightChatRail() {
  const { user: me } = useAuth();
  const [feed, setFeed] = useState<{ id: string; user: string; time: string; text: string }[]>(DEMO_MESSAGES);

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
      setFeed((f) => [
        { id: crypto.randomUUID(), user: "Live", time: tick(), text: m.slice(0, 200) },
        ...f,
      ].slice(0, 24));
    };
    s.on("activity:new", onAct);
    return () => {
      s.off("activity:new", onAct);
    };
  }, []);

  return (
    <aside className="fixed bottom-0 right-0 top-14 z-20 hidden w-[300px] shrink-0 flex-col border-l border-border-default bg-bg-secondary xl:flex">
      <div className="border-b border-border-default px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-sm font-bold tracking-wide text-text-primary">Online Chat</span>
          <span className="text-lg opacity-80" aria-hidden>
            💬
          </span>
        </div>
        <Link
          href="/market"
          className="mt-3 block rounded-xl border border-border-default bg-bg-tertiary/80 p-2.5 transition hover:border-accent-cyan/30 hover:shadow-glow-cyan"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Featured</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">Browse limiteds</p>
          <p className="mt-0.5 text-xs text-text-secondary">Deposit & trade on Wallet</p>
          <span className="mt-2 inline-flex rounded-lg bg-accent-cyan px-3 py-1.5 text-xs font-bold text-[#0a0e14] transition hover:brightness-110">
            Open market
          </span>
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <ul className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {feed.map((row) => (
            <li key={row.id} className="rounded-xl bg-bg-tertiary/50 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-cyan/15 text-[10px] font-bold text-accent-cyan">
                  {row.user.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-text-primary">{row.user}</span>
                    <span className="shrink-0 text-[10px] text-text-muted">{row.time}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-text-secondary">{row.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-border-default p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border-default bg-bg-tertiary/60 px-2 py-1.5">
            <span className="text-text-muted" aria-hidden>
              😊
            </span>
            <input
              type="text"
              readOnly
              placeholder={me ? "Write something…" : "Log in to chat"}
              className="min-w-0 flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <button type="button" className="shrink-0 text-accent-cyan" aria-label="Send" disabled>
              ➤
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan shadow-glow-cyan" />
            Socket feed + demo lines
          </p>
        </div>
      </div>
    </aside>
  );
}
