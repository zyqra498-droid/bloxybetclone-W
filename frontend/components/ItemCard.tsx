"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { LimitedTier, MarketItemDisplay } from "@/lib/robloxLimiteds";
import { LIMITED_PLACEHOLDER_PATH, getRobloxItemImageUrl } from "@/lib/robloxLimiteds";
import { formatCoins } from "@/lib/format";

const tierBorder: Record<LimitedTier, string> = {
  common: "border-[#888780]",
  rare: "border-accent-blue/90",
  epic: "border-accent-purple/90",
  legendary: "border-accent-gold shadow-[0_0_20px_rgba(245,197,66,0.35)]",
  mythic: "border-transparent mythic-border",
};

function getItemImageUrl(item: {
  robloxCatalogAssetId?: string | null;
  imageUrl?: string;
}): string {
  const c = item.robloxCatalogAssetId?.trim();
  if (c && /^\d+$/.test(c)) return getRobloxItemImageUrl(c);
  return item.imageUrl || LIMITED_PLACEHOLDER_PATH;
}

export function ItemCard({
  item,
  selected,
  onSelect,
  showDemand = true,
  robloxCatalogAssetId,
}: {
  item: MarketItemDisplay;
  selected?: boolean;
  onSelect?: () => void;
  showDemand?: boolean;
  /** When the parent tracks catalog id separately from `item` shape. */
  robloxCatalogAssetId?: string | null;
}) {
  const catalogId = robloxCatalogAssetId ?? item.robloxCatalogAssetId;
  const primarySrc = getItemImageUrl({ robloxCatalogAssetId: catalogId });
  const [imgSrc, setImgSrc] = useState(primarySrc);
  useEffect(() => {
    setImgSrc(getItemImageUrl({ robloxCatalogAssetId: catalogId }));
  }, [catalogId]);
  const isMythic = item.tier === "mythic";
  const isLegendary = item.tier === "legendary";

  const cardClass = `relative flex flex-col overflow-hidden rounded-xl bg-bg-tertiary transition-shadow ${
    isMythic ? "mythic-border" : `border-2 ${tierBorder[item.tier]}`
  } ${selected ? "ring-2 ring-accent-purple ring-offset-2 ring-offset-bg-primary" : ""} ${
    isLegendary ? "animate-godly-float" : ""
  }`;

  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      className={cardClass}
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
    >
      <div className="relative z-[1] flex flex-1 flex-col p-3">
        <div className="relative mx-auto aspect-square w-full max-w-[140px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Roblox thumbnail URLs + CDN behavior */}
          <img
            src={imgSrc}
            alt={item.name}
            crossOrigin="anonymous"
            className="h-full w-full object-contain p-2"
            onError={() => setImgSrc(LIMITED_PLACEHOLDER_PATH)}
          />
        </div>
        <p className="mt-2 line-clamp-2 text-center font-display text-sm font-semibold text-text-primary">{item.name}</p>
        <p className="mt-1 text-center font-display text-lg text-accent-gold">◈ {formatCoins(item.valueCoins)}</p>
        {showDemand && <p className="text-center text-xs text-text-secondary">Demand {item.demand}/100</p>}
      </div>
      {selected && (
        <div className="absolute right-2 top-2 z-[2] flex h-7 w-7 items-center justify-center rounded-full bg-accent-purple text-white shadow-lg">
          ✓
        </div>
      )}
    </motion.div>
  );
}
