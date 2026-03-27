import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { fetchAssetDetails, fetchAssetThumbnailUrl, fetchUserCollectibles } from "../services/robloxApi.js";
import { resolveItemPricing } from "../services/gameTagging.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { inventoryLimiter } from "../middleware/rateLimits.js";
import { pickIdleBot } from "../services/botManager.js";
import { TradeDirection, TradeStatus } from "@prisma/client";
import { enqueueTradeJob } from "../services/tradeQueue.js";
import { withLock } from "../lib/redisLock.js";
import { getConfig } from "../config.js";
import { requireCatalogAssetForLiveTrades } from "../lib/catalogTradeAsset.js";

const router = Router();

function tradeExpiresAt(): Date {
  const sec = getConfig().TRADE_SESSION_TTL_SEC;
  return new Date(Date.now() + sec * 1000);
}

router.get("/fetch", requireAuth, inventoryLimiter(), async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const assets = await fetchUserCollectibles(user.robloxId);
    const ids = [...new Set(assets.map((a) => a.assetId))];
    const names = await fetchAssetDetails(ids);
    const walletIds = new Set(
      (await prisma.userItem.findMany({ where: { userId: user.id }, select: { itemId: true } })).map((x) => x.itemId),
    );

    const items = await Promise.all(
      assets.map(async (a) => {
        const aid = String(a.assetId);
        const name = names.get(a.assetId)?.name ?? a.name ?? `Asset ${aid}`;
        const { gameSource, valueCoins } = await resolveItemPricing(aid, name);
        const userAssetId = String(a.userAssetId);
        const imageUrl = await fetchAssetThumbnailUrl(aid);
        return {
          userAssetId,
          robloxAssetId: aid,
          itemName: name,
          gameSource,
          valueCoins,
          tradable: !walletIds.has(userAssetId),
          onSite: walletIds.has(userAssetId),
          imageUrl,
        };
      }),
    );

    res.json({ items });
  } catch (e) {
    console.error("[inventory] /fetch", e);
    res.status(502).json({ error: "Could not build inventory.", items: [] });
  }
});

router.get("/trades", requireAuth, inventoryLimiter(), async (req: AuthedRequest, res) => {
  const rows = await prisma.trade.findMany({
    where: { userId: req.userId! },
    orderBy: { initiatedAt: "desc" },
    take: 50,
    include: { bot: { select: { robloxUsername: true } } },
  });
  res.json({
    trades: rows.map((t) => ({
      id: t.id,
      direction: t.direction,
      status: t.status,
      itemsJson: t.itemsJson,
      initiatedAt: t.initiatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
      expiresAt: t.expiresAt?.toISOString() ?? null,
      robloxTradeId: t.robloxTradeId,
      matchedSenderName: t.matchedSenderName,
      failureReason: t.failureReason,
      botUsername: t.bot.robloxUsername,
    })),
  });
});

router.get("/deposited", requireAuth, inventoryLimiter(), async (req: AuthedRequest, res) => {
  const rows = await prisma.userItem.findMany({
    where: { userId: req.userId!, status: "deposited" },
    orderBy: { depositedAt: "desc" },
  });
  const items = await Promise.all(
    rows.map(async (i) => ({
      id: i.id,
      itemId: i.itemId,
      robloxAssetId: i.robloxAssetId,
      itemName: i.itemName,
      gameSource: i.gameSource,
      valueCoins: Number(i.valueCoins),
      status: i.status,
      depositedAt: i.depositedAt?.toISOString() ?? null,
      imageUrl: await fetchAssetThumbnailUrl(i.robloxAssetId),
    })),
  );
  res.json({ items });
});

const depositSchema = z.object({
  items: z
    .array(
      z.object({
        robloxAssetId: z.string(),
        userAssetId: z.string(),
        itemName: z.string(),
        gameSource: z.string(),
        valueCoins: z.number().positive(),
      }),
    )
    .min(1),
  gameMode: z.string().optional(),
});

router.post("/deposit", requireAuth, requireCsrf, inventoryLimiter(), async (req: AuthedRequest, res) => {
  const body = depositSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }

  const result = await withLock(`deposit:${req.userId}`, 30, async () => {
    const botId = await pickIdleBot(req.userId!, body.data.gameMode);
    if (!botId) {
      return { error: "No bot available" as const };
    }
    const itemsJson = body.data.items.map((i) => ({
      robloxAssetId: i.robloxAssetId,
      itemId: i.userAssetId,
      itemName: i.itemName,
      gameSource: i.gameSource,
      valueCoins: String(i.valueCoins),
    }));

    const trade = await prisma.trade.create({
      data: {
        botId,
        userId: req.userId!,
        direction: TradeDirection.deposit,
        itemsJson,
        status: TradeStatus.PENDING,
        expiresAt: tradeExpiresAt(),
      },
    });
    await enqueueTradeJob(trade.id);
    return { tradeId: trade.id };
  });

  if (!result) {
    res.status(429).json({ error: "Concurrent deposit in progress" });
    return;
  }
  if ("error" in result) {
    res.status(503).json({ error: result.error });
    return;
  }
  res.json(result);
});

const catalogDepositSchema = z
  .object({
    robloxAssetId: z.string().min(1).optional(),
    itemName: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.robloxAssetId?.trim()) || Boolean(d.itemName?.trim()), {
    message: "Provide robloxAssetId and/or itemName",
  });

/** Market "Deposit to wallet": credits site inventory from admin catalog (no Roblox trade). */
router.post("/catalog-deposit", requireAuth, requireCsrf, inventoryLimiter(), async (req: AuthedRequest, res) => {
  const { CATALOG_INSTANT_DEPOSIT, MOCK_ROBLOX_TRADES } = getConfig();
  if (!CATALOG_INSTANT_DEPOSIT) {
    res.status(403).json({ error: "Catalog deposit is disabled." });
    return;
  }
  const body = catalogDepositSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const aid = body.data.robloxAssetId?.trim();
  const iname = body.data.itemName?.trim();
  let row = aid ? await prisma.itemValue.findUnique({ where: { robloxAssetId: aid } }) : null;
  if (!row && iname) {
    row = await prisma.itemValue.findFirst({
      where: { itemName: { equals: iname, mode: "insensitive" } },
    });
  }
  if (!row) {
    res.status(404).json({
      error:
        "Item is not in the price catalog. Run npm run db:seed (or prisma db seed) for Roblox Limited rows, or add this item in admin.",
    });
    return;
  }
  const resolved = requireCatalogAssetForLiveTrades(row, MOCK_ROBLOX_TRADES);
  if (!resolved.ok) {
    res.status(400).json({ error: resolved.error });
    return;
  }
  const itemId = randomUUID();
  const userItem = await prisma.userItem.create({
    data: {
      userId: req.userId!,
      itemId,
      itemName: row.itemName,
      gameSource: row.gameSource,
      valueCoins: row.valueCoins,
      robloxAssetId: resolved.assetId,
      status: "deposited",
      depositedAt: new Date(),
    },
  });
  const imageUrl = await fetchAssetThumbnailUrl(userItem.robloxAssetId);
  res.status(201).json({
    item: {
      id: userItem.id,
      itemId: userItem.itemId,
      robloxAssetId: userItem.robloxAssetId,
      itemName: userItem.itemName,
      gameSource: userItem.gameSource,
      valueCoins: Number(userItem.valueCoins),
      status: userItem.status,
      depositedAt: userItem.depositedAt?.toISOString() ?? null,
      imageUrl,
    },
  });
});

const withdrawSchema = z.object({
  userItemIds: z.array(z.string()).min(1),
});

router.post("/withdraw", requireAuth, requireCsrf, inventoryLimiter(), async (req: AuthedRequest, res) => {
  const body = withdrawSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }

  const { HOUSE_TAX_PERCENT } = getConfig();
  const items = await prisma.userItem.findMany({
    where: { userId: req.userId!, id: { in: body.data.userItemIds }, status: "deposited" },
  });
  if (items.length !== body.data.userItemIds.length) {
    res.status(400).json({ error: "Invalid items" });
    return;
  }

  const result = await withLock(`withdraw:${req.userId}`, 30, async () => {
    const botId = await pickIdleBot(req.userId!);
    if (!botId) return { error: "No bot available" as const };

    const itemsJson = items.map((i) => ({
      robloxAssetId: i.robloxAssetId,
      itemId: i.itemId,
      itemName: i.itemName,
      gameSource: i.gameSource,
      valueCoins: String(Number(i.valueCoins) * (1 - HOUSE_TAX_PERCENT / 100)),
    }));

    const trade = await prisma.trade.create({
      data: {
        botId,
        userId: req.userId!,
        direction: TradeDirection.withdraw,
        itemsJson,
        status: TradeStatus.PENDING,
        expiresAt: tradeExpiresAt(),
      },
    });
    await enqueueTradeJob(trade.id);
    return { tradeId: trade.id };
  });

  if (!result) {
    res.status(429).json({ error: "Concurrent withdraw" });
    return;
  }
  if ("error" in result) {
    res.status(503).json({ error: result.error });
    return;
  }
  res.json(result);
});

export default router;
