"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatCoins } from "@/lib/format";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";

type PublicUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  siteCreatedAt: string;
  balanceCoins: number | null;
  lockedCoins: number | null;
  totalWins: number;
  isSelf?: boolean;
};

export default function PublicProfilePage() {
  const params = useParams();
  const { user: sessionUser } = useAuth();
  const username = typeof params.username === "string" ? params.username : "";
  const [data, setData] = useState<PublicUser | null>(null);
  const [history, setHistory] = useState<{ id: string; status: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setErr(null);
    fetch(`/api/users/public/${encodeURIComponent(username)}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setErr("User not found"));
  }, [username]);

  useEffect(() => {
    if (!data?.id || !sessionUser || sessionUser.username.toLowerCase() !== username.toLowerCase()) {
      setHistory([]);
      return;
    }
    void apiFetch("/api/games/coinflip/history").then((r) =>
      r.ok ? r.json().then((d) => setHistory((d.history ?? []) as { id: string; status: string }[])) : null,
    );
  }, [data?.id, sessionUser, username]);

  if (err || !data) {
    return (
      <div className="rounded-2xl border border-border-default bg-bg-secondary/90 p-8 text-center text-text-secondary shadow-card">
        {err ?? "Loading…"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BloxyPageHeader title={`@${data.username}`} subtitle="Public profile · balances may be hidden." eyebrow="Player" />
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-default bg-bg-secondary/95 p-8 shadow-card md:flex-row md:items-start">
        {data.avatarUrl ? (
          <Image src={data.avatarUrl} alt="" width={120} height={120} className="rounded-2xl border-4 border-accent-cyan/40 shadow-glow-cyan" unoptimized />
        ) : (
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-2xl border-4 border-accent-cyan/40 bg-bg-tertiary text-4xl font-bold text-text-primary">
            {data.username.slice(0, 1)}
          </div>
        )}
        <div>
          <p className="text-sm text-text-secondary">Member since {new Date(data.siteCreatedAt).toLocaleDateString()}</p>
          <div className="mt-4 flex flex-wrap gap-4 font-display text-lg">
            {data.balanceCoins != null && data.lockedCoins != null ? (
              <>
                <span className="text-accent-gold">◈ {formatCoins(data.balanceCoins)}</span>
                <span className="text-text-secondary">Locked ◈ {formatCoins(data.lockedCoins)}</span>
              </>
            ) : (
              <span className="text-text-secondary">Balances hidden</span>
            )}
            <span className="text-accent-green">Wins recorded: {data.totalWins}</span>
          </div>
          <Link href="/wallet" className="mt-4 inline-block text-sm font-semibold text-accent-cyan hover:underline">
            Back to wallet
          </Link>
        </div>
      </div>

      <section>
        <h2 className="font-display text-xl font-bold text-text-primary">Recent coinflip rounds</h2>
        <p className="text-sm text-text-secondary">Shown when you are logged in as this user (history is private to session).</p>
        <ul className="mt-3 space-y-2 text-sm">
          {history.slice(0, 10).map((h) => (
            <li key={h.id} className="rounded-xl border border-border-default bg-bg-secondary/90 px-3 py-2">
              Round {h.id.slice(0, 8)}… · {h.status}
            </li>
          ))}
          {history.length === 0 && <li className="text-text-secondary">No history loaded (log in as this user to see your games).</li>}
        </ul>
      </section>
    </div>
  );
}
