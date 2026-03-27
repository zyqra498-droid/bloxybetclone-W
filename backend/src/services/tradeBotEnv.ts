import { prisma } from "../lib/prisma.js";
import { encryptString } from "../lib/cryptoUtil.js";
import { getConfig } from "../config.js";

/**
 * If TRADE_BOT_COOKIE (and username) are set in .env, create or update a `bots` row on startup.
 * Trades still reference the DB bot id — this avoids POST /api/bots/add-bot for local/dev.
 */
export async function syncTradeBotFromEnv(): Promise<void> {
  const cfg = getConfig();
  const cookie = cfg.TRADE_BOT_COOKIE?.trim();
  const username = cfg.TRADE_BOT_ROBLOX_USERNAME?.trim();
  if (!cookie) return;
  if (!username) {
    console.warn("[trade-bot] TRADE_BOT_COOKIE is set but TRADE_BOT_ROBLOX_USERNAME is missing — set both in .env");
    return;
  }
  const uid = cfg.TRADE_BOT_ROBLOX_USER_ID?.trim();
  const enc = encryptString(cookie);

  const existing = await prisma.bot.findFirst({ where: { robloxUsername: username } });
  if (existing) {
    await prisma.bot.update({
      where: { id: existing.id },
      data: {
        robloxCookieEncrypted: enc,
        ...(uid ? { robloxUserId: uid } : {}),
      },
    });
    console.log(`[trade-bot] Updated cookie from env for bot @${username}`);
    return;
  }

  await prisma.bot.create({
    data: {
      robloxUsername: username,
      robloxUserId: uid || null,
      robloxCookieEncrypted: enc,
      status: "idle",
    },
  });
  console.log(`[trade-bot] Created bot from env @${username}`);
}
