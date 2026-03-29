"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { formatCoins } from "@/lib/format";
import { thumbnailSrcForCatalog } from "@/lib/robloxLimiteds";

export type BloxyCoinflipRoom = {
  id: string;
  stakeMode?: "items" | "coins";
  creatorId: string;
  creator: { username: string; avatarUrl?: string | null };
  creatorItemsJson?: { itemName?: string; thumb?: string; valueCoins?: number }[] | null;
  total: number;
  expiresAt: string;
};

function itemThumbSrc(thumb: string | undefined): string {
  return thumbnailSrcForCatalog(thumb);
}

export function CoinflipRoomRow({
  room,
  meId,
  joinHref,
  index = 0,
}: {
  room: BloxyCoinflipRoom;
  meId: string | null | undefined;
  joinHref: string;
  index?: number;
}) {
  const items = room.creatorItemsJson ?? [];
  const showItems = room.stakeMode !== "coins" && items.length > 0;
  const total = room.total;
  const low = total * 0.95;
  const high = total * 1.05;
  const canJoin = meId && room.creatorId !== meId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.24) }}
      whileHover={{ scale: 1.005 }}
      className="flex flex-col gap-4 rounded-2xl border border-border-default bg-bg-tertiary/40 p-4 shadow-card transition hover:border-accent-cyan/25 sm:flex-row sm:items-center sm:gap-5"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex shrink-0 items-center pl-1">
          <span className="relative z-[1] flex h-12 w-12 overflow-hidden rounded-full border-2 border-accent-cyan bg-bg-secondary ring-2 ring-bg-primary">
            {room.creator.avatarUrl ? (
              <Image src={room.creator.avatarUrl} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-text-secondary">
                {room.creator.username.slice(0, 1)}
              </span>
            )}
          </span>
          <span className="-ml-4 flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-white/15 bg-bg-hover text-[10px] font-semibold text-text-muted">
            ?
          </span>
        </div>

        {showItems ? (
          <div className="flex max-w-[200px] flex-wrap gap-1.5 sm:max-w-none">
            {items.slice(0, 6).map((it, i) => (
              <span
                key={`${it.itemName ?? "it"}-${i}`}
                className="flex h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-bg-secondary"
              >
                <Image src={itemThumbSrc(it.thumb)} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized />
              </span>
            ))}
            {items.length > 6 && (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-bg-hover text-[10px] font-bold text-text-secondary">
                +{items.length - 6}
              </span>
            )}
          </div>
        ) : (
          <div className="flex h-10 items-center text-xs text-text-muted">Coin stake room</div>
        )}
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-accent-gold/40 bg-gradient-to-br from-amber-500/20 to-bg-secondary font-display text-lg font-bold text-accent-gold">
          T
        </div>

        <div className="min-w-[120px] text-right">
          <p className="flex items-center justify-end gap-1 font-display text-lg font-bold tabular-nums text-text-primary">
            <span className="text-accent-cyan" aria-hidden>
              ◈
            </span>
            {formatCoins(total)}
          </p>
          <p className="text-[11px] text-text-muted tabular-nums">
            {formatCoins(low)} – {formatCoins(high)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {canJoin ? (
            <Link
              href={joinHref ?? `/coinflip?join=${encodeURIComponent(room.id)}`}
              className="inline-flex min-w-[88px] items-center justify-center rounded-xl bg-accent-cyan px-4 py-2 text-center text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110 active:scale-[0.98]"
            >
              Join
            </Link>
          ) : (
            <span className="inline-flex min-w-[88px] justify-center rounded-xl bg-bg-hover px-4 py-2 text-center text-sm font-medium text-text-muted">
              Yours
            </span>
          )}
          <Link
            href="/wallet"
            className="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-border-default bg-bg-hover px-4 py-2 text-center text-sm font-semibold text-text-primary transition hover:border-accent-cyan/25 hover:text-accent-cyan"
          >
            View
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
