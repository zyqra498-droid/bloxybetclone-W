import type { Trade, User } from "@prisma/client";

export type IncomingRobloxTrade = {
  robloxTradeId: string;
  senderUsername: string;
  /** When present (from trade JSON), preferred over username vs display name mismatch. */
  partnerRobloxUserId?: number | null;
  /** Normalized Roblox asset IDs as strings */
  assetIds: string[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Match an incoming Roblox trade to a pending deposit session.
 * Expects trade.itemsJson as array of { robloxAssetId, ... }.
 */
export function incomingMatchesDepositSession(
  trade: Trade,
  user: Pick<User, "username" | "robloxId">,
  incoming: IncomingRobloxTrade,
): boolean {
  if (trade.direction !== "deposit") return false;
  const idMatch =
    incoming.partnerRobloxUserId != null && String(incoming.partnerRobloxUserId) === user.robloxId.trim();
  const nameMatch = norm(incoming.senderUsername) === norm(user.username);
  if (!idMatch && !nameMatch) return false;

  const expected = trade.itemsJson as unknown as { robloxAssetId: string }[];
  if (!Array.isArray(expected) || expected.length === 0) return false;

  const expectedSet = new Set(expected.map((e) => norm(String(e.robloxAssetId))));
  const incomingSet = new Set(incoming.assetIds.map((a) => norm(a)));
  if (incomingSet.size !== expectedSet.size) return false;
  for (const id of expectedSet) {
    if (!incomingSet.has(id)) return false;
  }
  return true;
}
