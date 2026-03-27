import Bull from "bull";
import { getConfig } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { TradeDirection, TradeStatus } from "@prisma/client";
import { decryptString, hmacMemo } from "../lib/cryptoUtil.js";
import { getIo } from "../socket/registry.js";
import { pollIncomingRobloxTrades } from "./robloxTradePoller.js";
import { incomingMatchesDepositSession } from "./robloxTradeMatching.js";
import { writeAudit } from "./auditLog.js";
import { fetchUserCollectibles } from "./robloxApi.js";
import {
  normalizeRobloxCookieHeader,
  fetchRobloxCsrfToken,
  getAuthenticatedRobloxUserId,
  sendTradeBotGivesUserReceives,
  getTradeDetail,
  readTradeStatus,
  acceptInboundTrade,
} from "./robloxTradesClient.js";

export const tradeQueue = new Bull<{ tradeId: string }>("trade-lifecycle", {
  redis: getConfig().REDIS_URL,
  defaultJobOptions: {
    removeOnComplete: 100,
    attempts: 5,
    backoff: { type: "fixed", delay: 5000 },
  },
});

type TradeItem = {
  robloxAssetId: string;
  itemId: string;
  itemName: string;
  gameSource: string;
  valueCoins: string;
};

async function finalizeTradeCompletion(tradeId: string): Promise<void> {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, include: { user: true } });
  if (!trade) return;

  const items = trade.itemsJson as unknown as TradeItem[];

  await prisma.trade.update({
    where: { id: tradeId },
    data: { status: TradeStatus.ACCEPTED, completedAt: new Date() },
  });
  await prisma.bot.update({
    where: { id: trade.botId },
    data: { status: "idle", currentTradeId: null },
  });

  if (trade.direction === "deposit") {
    for (const it of items) {
      await prisma.userItem.create({
        data: {
          userId: trade.userId,
          itemId: it.itemId,
          itemName: it.itemName,
          gameSource: it.gameSource,
          valueCoins: it.valueCoins,
          robloxAssetId: it.robloxAssetId,
          status: "deposited",
          depositedAt: new Date(),
        },
      });
    }
  } else {
    for (const it of items) {
      await prisma.userItem.updateMany({
        where: { userId: trade.userId, itemId: it.itemId, status: "deposited" },
        data: { status: "withdrawn" },
      });
    }
  }

  const cfg = getConfig();
  const withdrawBody =
    cfg.MOCK_ROBLOX_TRADES
      ? "Site inventory updated only (MOCK_ROBLOX_TRADES). Roblox did not send a real trade — items will not appear on your Roblox account."
      : "Items were sent to your Roblox account after the trade completed.";

  const notif = await prisma.notification.create({
    data: {
      userId: trade.userId,
      type: "trade",
      title: trade.direction === "deposit" ? "Deposit complete" : "Withdrawal complete",
      body: trade.direction === "deposit" ? "Items were deposited to your site inventory." : withdrawBody,
    },
  });
  getIo()?.to(`user:${trade.userId}`).emit("notification:new", {
    id: notif.id,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    createdAt: notif.createdAt.toISOString(),
  });

  await writeAudit({
    userId: trade.userId,
    action: "trade_completed",
    targetType: "trade",
    targetId: tradeId,
    metadata: { direction: trade.direction, robloxTradeId: trade.robloxTradeId },
  });

  getIo()?.to(`user:${trade.userId}`).emit("trade:update", { tradeId, status: "ACCEPTED" });
  getIo()?.to(`user:${trade.userId}`).emit("inventory:sync", {});
}

async function failWithdrawSession(
  tradeId: string,
  userId: string,
  botId: string,
  failureReason: string,
  userMessage: string,
): Promise<void> {
  await prisma.trade.update({
    where: { id: tradeId },
    data: { status: TradeStatus.FAILED, failureReason },
  });
  await prisma.bot
    .update({
      where: { id: botId },
      data: { status: "idle", currentTradeId: null },
    })
    .catch(() => {});
  getIo()?.to(`user:${userId}`).emit("trade:update", { tradeId, status: "FAILED" });
  const notif = await prisma.notification.create({
    data: { userId, type: "trade", title: "Withdrawal failed", body: userMessage },
  });
  getIo()?.to(`user:${userId}`).emit("notification:new", {
    id: notif.id,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    createdAt: notif.createdAt.toISOString(),
  });
}

/** Cookie decrypt / CSRF / authenticated user id failure before we can talk to Roblox. */
async function failRealWithdrawTrade(tradeId: string, userId: string, botId: string): Promise<void> {
  await failWithdrawSession(
    tradeId,
    userId,
    botId,
    "withdraw_bot_session_error",
    "Could not use the trade bot session. Verify the bot .ROBLOSECURITY cookie in admin and that the account can trade.",
  );
}

async function failDepositSession(
  tradeId: string,
  userId: string,
  botId: string,
  failureReason: string,
  userMessage: string,
): Promise<void> {
  await prisma.trade.update({
    where: { id: tradeId },
    data: { status: TradeStatus.FAILED, failureReason },
  });
  await prisma.bot
    .update({
      where: { id: botId },
      data: { status: "idle", currentTradeId: null },
    })
    .catch(() => {});
  getIo()?.to(`user:${userId}`).emit("trade:update", { tradeId, status: "FAILED" });
  const notif = await prisma.notification.create({
    data: { userId, type: "trade", title: "Deposit failed", body: userMessage },
  });
  getIo()?.to(`user:${userId}`).emit("notification:new", {
    id: notif.id,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    createdAt: notif.createdAt.toISOString(),
  });
}

async function failRealDepositTrade(tradeId: string, userId: string, botId: string): Promise<void> {
  await failDepositSession(
    tradeId,
    userId,
    botId,
    "deposit_bot_session_error",
    "Could not use the trade bot session to accept your deposit. Verify the bot .ROBLOSECURITY cookie and that the account can receive trades.",
  );
}

export function registerTradeWorker(): void {
  tradeQueue.process(async (job) => {
    const { tradeId } = job.data;
    const trade = await prisma.trade.findUnique({ where: { id: tradeId }, include: { bot: true, user: true } });
    if (!trade) return;

    const { MOCK_ROBLOX_TRADES } = getConfig();
    const mockRid = `mock-${tradeId.slice(0, 12)}`;

    if (
      trade.expiresAt &&
      trade.expiresAt < new Date() &&
      (trade.status === TradeStatus.PENDING || trade.status === TradeStatus.OFFER_SENT)
    ) {
      await prisma.trade.update({
        where: { id: tradeId },
        data: { status: TradeStatus.TIMEOUT, failureReason: "session_expired" },
      });
      await prisma.bot
        .update({
          where: { id: trade.botId },
          data: { status: "idle", currentTradeId: null },
        })
        .catch(() => {});
      getIo()?.to(`user:${trade.userId}`).emit("trade:update", { tradeId, status: "TIMEOUT" });
      return;
    }

    if (trade.status === TradeStatus.PENDING) {
      if (MOCK_ROBLOX_TRADES) {
        const dup = await prisma.trade.findFirst({
          where: { robloxTradeId: mockRid, id: { not: tradeId } },
        });
        if (dup) {
          await prisma.trade.update({
            where: { id: tradeId },
            data: { status: TradeStatus.FAILED, failureReason: "duplicate_trade_id" },
          });
          return;
        }
      }
      await prisma.trade.update({
        where: { id: tradeId },
        data: {
          status: TradeStatus.OFFER_SENT,
          robloxTradeId: MOCK_ROBLOX_TRADES ? mockRid : trade.robloxTradeId,
          expectedMemoHmac: hmacMemo(tradeId),
        },
      });
      await prisma.bot.update({
        where: { id: trade.botId },
        data: { status: "busy", currentTradeId: tradeId },
      });
      getIo()?.to(`user:${trade.userId}`).emit("trade:update", { tradeId, status: "OFFER_SENT" });
    }

    const liveTrade = await prisma.trade.findUnique({ where: { id: tradeId }, include: { bot: true, user: true } });
    if (!liveTrade || liveTrade.status !== TradeStatus.OFFER_SENT) return;

    if (!MOCK_ROBLOX_TRADES) {
      if (liveTrade.direction === TradeDirection.withdraw) {
        let cookieHeader: string;
        try {
          cookieHeader = normalizeRobloxCookieHeader(decryptString(liveTrade.bot.robloxCookieEncrypted));
        } catch (e) {
          console.warn("[tradeQueue] withdraw cookie decrypt", e);
          await failRealWithdrawTrade(tradeId, liveTrade.userId, liveTrade.botId);
          return;
        }
        if (!cookieHeader) {
          await failRealWithdrawTrade(tradeId, liveTrade.userId, liveTrade.botId);
          return;
        }

        let botUserId = liveTrade.bot.robloxUserId ? Number(liveTrade.bot.robloxUserId) : NaN;
        if (!Number.isFinite(botUserId)) {
          const authed = await getAuthenticatedRobloxUserId(cookieHeader);
          if (!authed) {
            await failRealWithdrawTrade(tradeId, liveTrade.userId, liveTrade.botId);
            return;
          }
          botUserId = authed;
          await prisma.bot.update({ where: { id: liveTrade.botId }, data: { robloxUserId: String(authed) } }).catch(() => {});
        }

        const items = liveTrade.itemsJson as unknown as TradeItem[];
        let collectibles;
        try {
          collectibles = await fetchUserCollectibles(String(botUserId));
        } catch (e) {
          console.warn("[tradeQueue] fetch bot collectibles", e);
          await failRealWithdrawTrade(tradeId, liveTrade.userId, liveTrade.botId);
          return;
        }

        const chosenUaids: number[] = [];
        const usedUa = new Set<number>();
        for (const it of items) {
          const aid = String(it.robloxAssetId);
          const row = collectibles.find((c) => String(c.assetId) === aid && !usedUa.has(c.userAssetId));
          if (!row) {
            await failWithdrawSession(
              tradeId,
              liveTrade.userId,
              liveTrade.botId,
              `bot_inventory_missing_asset:${aid}`,
              `The trade bot does not own a collectible matching asset ${aid} on Roblox. Deposit that item to the bot first, or use MOCK_ROBLOX_TRADES=true for testing.`,
            );
            return;
          }
          usedUa.add(row.userAssetId);
          chosenUaids.push(row.userAssetId);
        }

        let csrf: string;
        try {
          csrf = await fetchRobloxCsrfToken(cookieHeader);
        } catch (e) {
          console.warn("[tradeQueue] withdraw CSRF", e);
          await failRealWithdrawTrade(tradeId, liveTrade.userId, liveTrade.botId);
          return;
        }

        const rtid = liveTrade.robloxTradeId;
        if (!rtid) {
          const targetUid = Number(liveTrade.user.robloxId);
          const send = await sendTradeBotGivesUserReceives({
            cookieHeader,
            csrf,
            botUserId,
            targetUserId: targetUid,
            botUserAssetIds: chosenUaids,
          });
          if (!send.ok) {
            await failWithdrawSession(
              tradeId,
              liveTrade.userId,
              liveTrade.botId,
              `roblox_send:${send.error}`,
              `Roblox rejected the outgoing trade: ${send.error}. Check bot trade restrictions, target user trade settings, and item lock status.`,
            );
            return;
          }
          await prisma.trade.update({
            where: { id: tradeId },
            data: { robloxTradeId: send.tradeId },
          });
          await (job as unknown as { moveToDelayed: (ts: number) => Promise<void> }).moveToDelayed(Date.now() + 4000);
          return;
        }

        const detail = await getTradeDetail(cookieHeader, csrf, rtid);
        const st = readTradeStatus(detail);
        if (st && st.toLowerCase() === "completed") {
          await finalizeTradeCompletion(tradeId);
          return;
        }
        if (st) {
          const sl = st.toLowerCase();
          if (["declined", "expired", "rejected", "failed"].includes(sl) || sl.includes("declin")) {
            await failWithdrawSession(
              tradeId,
              liveTrade.userId,
              liveTrade.botId,
              `roblox_trade_${st}`,
              `The Roblox trade was not completed (status: ${st}). Your site items were not marked withdrawn.`,
            );
            return;
          }
        }

        await (job as unknown as { moveToDelayed: (ts: number) => Promise<void> }).moveToDelayed(Date.now() + 5000);
        return;
      }

      if (liveTrade.direction === TradeDirection.deposit) {
        let cookieHeader: string;
        try {
          cookieHeader = normalizeRobloxCookieHeader(decryptString(liveTrade.bot.robloxCookieEncrypted));
        } catch (e) {
          console.warn("[tradeQueue] deposit cookie decrypt", e);
          await failRealDepositTrade(tradeId, liveTrade.userId, liveTrade.botId);
          return;
        }
        if (!cookieHeader) {
          await failRealDepositTrade(tradeId, liveTrade.userId, liveTrade.botId);
          return;
        }

        let csrf: string;
        try {
          csrf = await fetchRobloxCsrfToken(cookieHeader);
        } catch (e) {
          console.warn("[tradeQueue] deposit CSRF", e);
          await failRealDepositTrade(tradeId, liveTrade.userId, liveTrade.botId);
          return;
        }

        const linkedRid = liveTrade.robloxTradeId?.trim();
        if (linkedRid) {
          const detail = await getTradeDetail(cookieHeader, csrf, linkedRid);
          const st = readTradeStatus(detail);
          if (st && st.toLowerCase() === "completed") {
            await finalizeTradeCompletion(tradeId);
            return;
          }
          if (st) {
            const sl = st.toLowerCase();
            if (["declined", "expired", "rejected", "failed"].includes(sl) || sl.includes("declin")) {
              await failDepositSession(
                tradeId,
                liveTrade.userId,
                liveTrade.botId,
                `roblox_trade_${st}`,
                `The Roblox deposit trade did not complete (status: ${st}). Nothing was credited to your site wallet.`,
              );
              return;
            }
          }
          await (job as unknown as { moveToDelayed: (ts: number) => Promise<void> }).moveToDelayed(Date.now() + 5000);
          return;
        }

        const incomingList = await pollIncomingRobloxTrades(liveTrade.botId);
        for (const inc of incomingList) {
          if (!incomingMatchesDepositSession(liveTrade, liveTrade.user, inc)) continue;
          const dup = await prisma.trade.findFirst({
            where: { robloxTradeId: inc.robloxTradeId, id: { not: tradeId } },
          });
          if (dup) continue;

          let acc = await acceptInboundTrade(cookieHeader, csrf, inc.robloxTradeId);
          if (!acc.ok && acc.retryCsrf) {
            try {
              csrf = await fetchRobloxCsrfToken(cookieHeader);
            } catch {
              await failDepositSession(
                tradeId,
                liveTrade.userId,
                liveTrade.botId,
                "deposit_csrf_retry_failed",
                "Roblox blocked the deposit accept (session error). Try starting a new deposit.",
              );
              return;
            }
            acc = await acceptInboundTrade(cookieHeader, csrf, inc.robloxTradeId);
          }
          if (!acc.ok) {
            await failDepositSession(
              tradeId,
              liveTrade.userId,
              liveTrade.botId,
              `roblox_accept:${acc.error}`,
              `The bot could not accept your incoming Roblox trade: ${acc.error}. Check trade limits and that the offer matches your session.`,
            );
            return;
          }

          await prisma.trade.update({
            where: { id: tradeId },
            data: {
              robloxTradeId: inc.robloxTradeId,
              matchedSenderName: inc.senderUsername,
            },
          });
          await (job as unknown as { moveToDelayed: (ts: number) => Promise<void> }).moveToDelayed(Date.now() + 4000);
          return;
        }
      }
      await (job as unknown as { moveToDelayed: (ts: number) => Promise<void> }).moveToDelayed(Date.now() + 5000);
      return;
    }

    await finalizeTradeCompletion(tradeId);
  });
}

export async function enqueueTradeJob(tradeId: string): Promise<void> {
  await tradeQueue.add({ tradeId }, { jobId: tradeId, removeOnComplete: true });
}

export function buildTradeMemo(tradeId: string): string {
  return `RG:${hmacMemo(tradeId)}`;
}
