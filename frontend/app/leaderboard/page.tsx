"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatCoins } from "@/lib/format";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";

type Row = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  wagered: number;
  wins: number;
};

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "alltime">("daily");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const q = period === "alltime" ? "alltime" : period;
    fetch(`/api/stats/leaderboard?period=${q}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => {});
  }, [period]);

  return (
    <div className="space-y-8">
      <BloxyPageHeader
        title="Leaderboard"
        subtitle="Top ◈ wagered for the selected period — climb the ranks on coinflip and jackpot."
        eyebrow="Compete"
      />
      <div className="flex flex-wrap gap-2">
        {(["daily", "weekly", "alltime"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
              period === p
                ? "bg-accent-cyan font-bold text-[#0a0e14] shadow-glow-cyan"
                : "border border-border-default bg-bg-secondary text-text-secondary hover:border-accent-cyan/20"
            }`}
          >
            {p === "alltime" ? "All-time" : p}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {rows.slice(0, 3).map((r, i) => (
          <div
            key={r.userId}
            className={`rounded-xl border p-4 ${
              i === 0
                ? "border-amber-400/50 bg-gradient-to-b from-amber-900/20 to-bg-secondary"
                : i === 1
                  ? "border-slate-300/40 bg-gradient-to-b from-slate-700/20 to-bg-secondary"
                  : "border-amber-700/40 bg-gradient-to-b from-amber-900/10 to-bg-secondary"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{i === 0 ? "👑" : i === 1 ? "🥈" : "🥉"}</span>
              {r.avatarUrl ? (
                <Image src={r.avatarUrl} alt="" width={48} height={48} className="rounded-full" unoptimized />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-tertiary text-lg font-bold">
                  {r.username.slice(0, 1)}
                </div>
              )}
              <div>
                <Link href={`/profile/${encodeURIComponent(r.username)}`} className="font-semibold text-text-primary hover:underline">
                  {r.username}
                </Link>
                <p className="font-display text-sm text-accent-gold">◈ {formatCoins(r.wagered)} wagered</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-secondary text-text-secondary">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Player</th>
              <th className="p-3">Wagered</th>
              <th className="p-3">Wins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.userId} className="border-t border-border-default">
                <td className="p-3 font-display text-accent-gold">{idx + 1}</td>
                <td className="p-3">
                  <Link href={`/profile/${encodeURIComponent(r.username)}`} className="text-text-primary hover:underline">
                    {r.username}
                  </Link>
                </td>
                <td className="p-3 font-display text-accent-gold">{formatCoins(r.wagered)}</td>
                <td className="p-3">{r.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-text-secondary">No leaderboard data yet.</p>}
      </div>
    </div>
  );
}
