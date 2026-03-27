import { prisma } from "../lib/prisma.js";
import { decryptString } from "../lib/cryptoUtil.js";
import { getConfig } from "../config.js";
import type { IncomingRobloxTrade } from "./robloxTradeMatching.js";
import {
  normalizeRobloxCookieHeader,
  fetchRobloxCsrfToken,
  getAuthenticatedRobloxUserId,
  listInboundTradeIds,
  getTradeDetail,
  extractPartnerOfferCatalogAssetIds,
} from "./robloxTradesClient.js";

/**
 * Poll Roblox inbound trades for the bot account (deposit flow when MOCK_ROBLOX_TRADES=false).
 * Requires a valid `.ROBLOSECURITY` on the bot and (ideally) `bots.roblox_user_id` filled.
 */
export async function pollIncomingRobloxTrades(botId: string): Promise<IncomingRobloxTrade[]> {
  const { MOCK_ROBLOX_TRADES } = getConfig();
  if (MOCK_ROBLOX_TRADES) return [];

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return [];

  let cookieHeader: string;
  try {
    cookieHeader = normalizeRobloxCookieHeader(decryptString(bot.robloxCookieEncrypted));
  } catch (e) {
    console.warn("[roblox-trades] decrypt bot cookie failed", e);
    return [];
  }
  if (!cookieHeader) return [];

  let botUserId = bot.robloxUserId ? Number(bot.robloxUserId) : NaN;
  if (!Number.isFinite(botUserId)) {
    const authed = await getAuthenticatedRobloxUserId(cookieHeader);
    if (!authed) {
      console.warn(`[roblox-trades] bot ${botId}: no roblox_user_id and /users/authenticated failed`);
      return [];
    }
    botUserId = authed;
    await prisma.bot.update({ where: { id: botId }, data: { robloxUserId: String(authed) } }).catch(() => {});
  }

  let csrf: string;
  try {
    csrf = await fetchRobloxCsrfToken(cookieHeader);
  } catch (e) {
    console.warn("[roblox-trades] CSRF failed", e);
    return [];
  }

  let inboundIds: string[];
  try {
    inboundIds = await listInboundTradeIds(cookieHeader, csrf);
  } catch (e) {
    console.warn("[roblox-trades] list inbound failed", e);
    return [];
  }

  const out: IncomingRobloxTrade[] = [];
  for (const tid of inboundIds) {
    const detail = await getTradeDetail(cookieHeader, csrf, tid);
    if (!detail) continue;
    const parsed = extractPartnerOfferCatalogAssetIds(detail, botUserId);
    if (!parsed || parsed.assetIds.length === 0) continue;
    out.push({
      robloxTradeId: tid,
      senderUsername: parsed.partnerName,
      partnerRobloxUserId: parsed.partnerRobloxUserId,
      assetIds: parsed.assetIds,
    });
  }
  return out;
}
