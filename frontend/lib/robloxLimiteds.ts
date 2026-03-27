/**
 * Roblox Limited catalog helpers and seed data mirror (see prisma/seed.ts).
 */

export type LimitedTier = "common" | "rare" | "epic" | "legendary" | "mythic";

export type LimitedCategory = "hat" | "face" | "accessory" | "gear";

export function getTierFromValue(valueCoins: number): LimitedTier {
  if (valueCoins >= 1_000_000) return "mythic";
  if (valueCoins >= 200_000) return "legendary";
  if (valueCoins >= 50_000) return "epic";
  if (valueCoins >= 5_000) return "rare";
  return "common";
}

/** Border / accent: mythic uses animated gradient via CSS class `mythic-border`. */
export const TIER_COLORS: Record<LimitedTier, string> = {
  common: "#888780",
  rare: "#4f8ef7",
  epic: "#7c5cfc",
  legendary: "#f5c542",
  mythic: "rainbow",
};

export const TIER_LABELS: Record<LimitedTier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

/** Heuristic category for market filters (no extra DB column). */
export function inferLimitedCategory(itemName: string): LimitedCategory {
  const n = itemName.toLowerCase();
  if (n.includes("face")) return "face";
  if (n.includes("swordpack") || /\bgear\b/.test(n)) return "gear";
  if (
    n.includes("fedora") ||
    n.includes("crown") ||
    n.includes("valkyrie") ||
    n.includes("helm") ||
    n.includes("bucket") ||
    n.includes("headphones") ||
    n.includes("boa") ||
    n.includes("antlers") ||
    /\bhat\b/.test(n)
  ) {
    return "hat";
  }
  return "accessory";
}

export function demandFromValue(valueCoins: number): number {
  return Math.min(99, Math.max(1, 35 + Math.floor(valueCoins / 40_000)));
}

export const LIMITED_PLACEHOLDER_PATH = "/items/limiteds/placeholder.svg";

/** Direct PNG image URL (works as `<img src>`). */
export function getRobloxItemImageUrl(catalogAssetId: string): string {
  const id = catalogAssetId.trim();
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${encodeURIComponent(id)}&width=420&height=420&format=png`;
}

/** Roblox thumbnails API URL (returns JSON — use for server-side fetch only). */
export function getRobloxThumbnailApiUrl(catalogAssetId: string): string {
  return `https://thumbnails.roblox.com/v1/assets?assetIds=${encodeURIComponent(catalogAssetId)}&size=420x420&format=Png&isCircular=false`;
}

export function thumbnailSrcForCatalog(
  robloxCatalogAssetId: string | null | undefined,
): string {
  const c = robloxCatalogAssetId?.trim();
  if (c && /^\d+$/.test(c)) return getRobloxItemImageUrl(c);
  return LIMITED_PLACEHOLDER_PATH;
}

export type LimitedSeedRow = {
  robloxAssetId: string;
  itemName: string;
  gameSource: string;
  valueCoins: number;
  robloxCatalogAssetId: string;
};

/** Mirrors seed data — keep in sync with `prisma/seed.ts` import. */
export const LIMITED_ITEMS: LimitedSeedRow[] = [
  {
    robloxAssetId: "limited-sparkle-time-fedora",
    itemName: "Sparkle Time Fedora",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 500_000,
    robloxCatalogAssetId: "1285307",
  },
  {
    robloxAssetId: "limited-purple-sparkle-time-fedora",
    itemName: "Purple Sparkle Time Fedora",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 1_500_000,
    robloxCatalogAssetId: "63043890",
  },
  {
    robloxAssetId: "limited-midnight-blue-sparkle-time-fedora",
    itemName: "Midnight Blue Sparkle Time Fedora",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 2_000_000,
    robloxCatalogAssetId: "119916949",
  },
  {
    robloxAssetId: "limited-sparkle-time-valkyrie",
    itemName: "Sparkle Time Valkyrie",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 800_000,
    robloxCatalogAssetId: "1180433861",
  },
  {
    robloxAssetId: "limited-valkyrie-helm",
    itemName: "Valkyrie Helm",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 80_000,
    robloxCatalogAssetId: "1365767",
  },
  {
    robloxAssetId: "limited-purple-valkyrie",
    itemName: "Purple Valkyrie",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 120_000,
    robloxCatalogAssetId: "1365741",
  },
  {
    robloxAssetId: "limited-ice-valkyrie",
    itemName: "Ice Valkyrie",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 60_000,
    robloxCatalogAssetId: "1374610",
  },
  {
    robloxAssetId: "limited-red-sparkle-time-fedora",
    itemName: "Red Sparkle Time Fedora",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 1_800_000,
    robloxCatalogAssetId: "48592576",
  },
  {
    robloxAssetId: "limited-bluesteel-bucket",
    itemName: "Bluesteel Bucket",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 45_000,
    robloxCatalogAssetId: "1476594",
  },
  {
    robloxAssetId: "limited-domino-crown",
    itemName: "Domino Crown",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 900_000,
    robloxCatalogAssetId: "20573078",
  },
  {
    robloxAssetId: "limited-bighead",
    itemName: "Bighead",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 8000,
    robloxCatalogAssetId: "1048037",
  },
  {
    robloxAssetId: "limited-super-happy-face",
    itemName: "Super Happy Face",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 25_000,
    robloxCatalogAssetId: "21070012",
  },
  {
    robloxAssetId: "limited-perfectly-legitimate-business-hat",
    itemName: "Perfectly Legitimate Business Hat",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 12_000,
    robloxCatalogAssetId: "1082935",
  },
  {
    robloxAssetId: "limited-dominus-aureus",
    itemName: "Dominus Aureus",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 2_500_000,
    robloxCatalogAssetId: "138932378",
  },
  {
    robloxAssetId: "limited-classic-fedora",
    itemName: "Classic Fedora",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 5000,
    robloxCatalogAssetId: "1365835",
  },
  {
    robloxAssetId: "limited-red-fedora",
    itemName: "Red Fedora",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 7000,
    robloxCatalogAssetId: "1285574",
  },
  {
    robloxAssetId: "limited-clockwork-headphones",
    itemName: "Clockwork Headphones",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 15_000,
    robloxCatalogAssetId: "125013849",
  },
  {
    robloxAssetId: "limited-adurite-antlers",
    itemName: "Adurite Antlers",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 30_000,
    robloxCatalogAssetId: "48105278",
  },
  {
    robloxAssetId: "limited-sinister-fedora",
    itemName: "Sinister Fedora",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 18_000,
    robloxCatalogAssetId: "2966477",
  },
  {
    robloxAssetId: "limited-bluesteel-domino-crown",
    itemName: "Bluesteel Domino Crown",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 200_000,
    robloxCatalogAssetId: "48105368",
  },
  {
    robloxAssetId: "limited-viridian-domino-crown",
    itemName: "Viridian Domino Crown",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 150_000,
    robloxCatalogAssetId: "48105277",
  },
  {
    robloxAssetId: "limited-bucket-helmet",
    itemName: "Bucket Helmet",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 10_000,
    robloxCatalogAssetId: "1476557",
  },
  {
    robloxAssetId: "limited-bluesteel-swordpack",
    itemName: "Bluesteel Swordpack",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 35_000,
    robloxCatalogAssetId: "48105263",
  },
  {
    robloxAssetId: "limited-bombastic-boa",
    itemName: "Bombastic Boa",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 22_000,
    robloxCatalogAssetId: "48105247",
  },
  {
    robloxAssetId: "limited-orange-sparkle-time-fedora",
    itemName: "Orange Sparkle Time Fedora",
    gameSource: "ROBLOX_LIMITED",
    valueCoins: 1_200_000,
    robloxCatalogAssetId: "19398814",
  },
];

/** Single card / row display shape (market + ItemCard). */
export type MarketItemDisplay = {
  id: string;
  name: string;
  valueCoins: number;
  tier: LimitedTier;
  category: LimitedCategory;
  demand: number;
  robloxAssetId: string;
  robloxCatalogAssetId: string | null;
  gameSource: string;
};

export function catalogRowToMarketItem(r: {
  robloxAssetId: string;
  itemName: string;
  gameSource: string;
  valueCoins: number;
  robloxCatalogAssetId?: string | null;
}): MarketItemDisplay {
  return {
    id: r.robloxAssetId,
    name: r.itemName,
    valueCoins: r.valueCoins,
    tier: getTierFromValue(r.valueCoins),
    category: inferLimitedCategory(r.itemName),
    demand: demandFromValue(r.valueCoins),
    robloxAssetId: r.robloxAssetId,
    robloxCatalogAssetId: r.robloxCatalogAssetId ?? null,
    gameSource: r.gameSource,
  };
}
