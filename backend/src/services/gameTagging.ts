import { prisma } from "../lib/prisma.js";

/** Known game universe hints — extend via admin item_values. */
const TAG_BY_PREFIX: { prefix: string; game: string }[] = [
  { prefix: "ROBLOX_LIMITED_", game: "ROBLOX_LIMITED" },
];

export function inferGameFromItemName(name: string, assetId: string): string {
  const n = name.toUpperCase();
  for (const { prefix, game } of TAG_BY_PREFIX) {
    if (n.includes(prefix.replace("_", ""))) return game;
  }
  if (n.includes("BAND") || n.includes("DA HOOD")) return "Da Hood";
  if (n.includes("ADOPT")) return "Adopt Me";
  return "Limited";
}

/**
 * Resolves catalog pricing: prefer `item_values.robloxAssetId`, then case-insensitive `itemName`
 * (so catalog rows keyed as `limited-*` still price real Roblox collectibles with matching names).
 */
export async function resolveItemPricing(
  assetId: string,
  itemNameRaw: string,
): Promise<{ gameSource: string; valueCoins: number }> {
  const itemName = itemNameRaw.trim();
  let row = await prisma.itemValue.findUnique({ where: { robloxAssetId: assetId } });
  if (!row && itemName.length > 0) {
    row = await prisma.itemValue.findFirst({
      where: { itemName: { equals: itemName, mode: "insensitive" } },
    });
  }
  const gameSource = row?.gameSource ?? inferGameFromItemName(itemNameRaw, assetId);
  const valueCoins = row ? Number(row.valueCoins) : 0;
  return { gameSource, valueCoins };
}

export async function resolveGameSource(assetId: string, itemName: string): Promise<string> {
  const { gameSource } = await resolveItemPricing(assetId, itemName);
  return gameSource;
}
