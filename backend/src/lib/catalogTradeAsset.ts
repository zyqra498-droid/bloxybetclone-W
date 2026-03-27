import type { ItemValue } from "@prisma/client";

const NUMERIC_ASSET = /^\d+$/;

/** Numeric Roblox catalog limited id for matching collectibles / outbound trades. */
export function catalogRobloxAssetIdForTrade(
  row: Pick<ItemValue, "robloxAssetId" | "robloxCatalogAssetId">,
): string | null {
  const c = row.robloxCatalogAssetId?.trim();
  if (c && NUMERIC_ASSET.test(c)) return c;
  const p = row.robloxAssetId.trim();
  if (NUMERIC_ASSET.test(p)) return p;
  return null;
}

export function requireCatalogAssetForLiveTrades(
  row: Pick<ItemValue, "robloxAssetId" | "robloxCatalogAssetId">,
  mockRobloxTrades: boolean,
): { ok: true; assetId: string } | { ok: false; error: string } {
  if (mockRobloxTrades) {
    const num = catalogRobloxAssetIdForTrade(row);
    return { ok: true, assetId: num ?? row.robloxAssetId.trim() };
  }
  const id = catalogRobloxAssetIdForTrade(row);
  if (!id) {
    return {
      ok: false,
      error:
        "This catalog item has no numeric Roblox asset ID. In admin, set robloxCatalogAssetId for this row (the limited’s catalog id on Roblox) so withdrawals can send the correct item.",
    };
  }
  return { ok: true, assetId: id };
}
