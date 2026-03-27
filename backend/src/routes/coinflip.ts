import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { CoinflipRoomStatus, CoinflipStakeMode, LedgerEntryType, Prisma } from "@prisma/client";
import { subtractBalance, addBalance } from "../services/walletService.js";
import { writeAudit } from "../services/auditLog.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { gameCreateLimiter } from "../middleware/rateLimits.js";
import { getConfig } from "../config.js";
import { sha256Hex, coinflipWinnerIndex } from "../lib/provablyFair.js";
import { getIo } from "../socket/registry.js";
import { withLock } from "../lib/redisLock.js";
import { singleRouteParam } from "../lib/param.js";

const router = Router();

function sumItems(items: { valueCoins: unknown }[]): number {
  return items.reduce((s, i) => s + Number(i.valueCoins), 0);
}

const createSchema = z.object({
  userItemIds: z.array(z.string()).min(1),
  clientSeed: z.string().max(256).optional(),
});

router.post("/create", requireAuth, requireCsrf, gameCreateLimiter, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { COINFLIP_MIN_VALUE, COINFLIP_ROOM_MINUTES } = getConfig();

  const out = await withLock(`coinflip:${req.userId}`, 15, async () => {
    const items = await prisma.userItem.findMany({
      where: { userId: req.userId!, id: { in: parsed.data.userItemIds }, status: "deposited" },
    });
    if (items.length !== parsed.data.userItemIds.length) return { error: "Invalid items" as const };
    const total = sumItems(items);
    if (total < COINFLIP_MIN_VALUE) return { error: `Minimum ${COINFLIP_MIN_VALUE} coins` as const };

    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = sha256Hex(serverSeed);
    const clientSeed = parsed.data.clientSeed ?? crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + COINFLIP_ROOM_MINUTES * 60 * 1000);

    await prisma.userItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { status: "in_game" },
    });

    const creatorItemsJson = items.map((i) => ({
      userItemId: i.id,
      itemName: i.itemName,
      thumb: i.robloxAssetId,
      valueCoins: Number(i.valueCoins),
    }));

    const round = await prisma.coinflipRound.create({
      data: {
        creatorId: req.userId!,
        stakeMode: CoinflipStakeMode.items,
        creatorItemsJson,
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce: "",
        expiresAt,
        status: CoinflipRoomStatus.open,
        taxAmount: 0,
      },
    });

    await prisma.coinflipRound.update({
      where: { id: round.id },
      data: { nonce: round.id },
    });

    const payload = {
      room: {
        id: round.id,
        creatorId: round.creatorId,
        joinerId: null as string | null,
        creatorItemsJson,
        joinerItemsJson: null,
        totalCreator: total,
        totalJoiner: 0,
        serverSeedHash,
        clientSeed,
        expiresAt,
        status: round.status,
      },
    };

    getIo()?.emit("coinflip:room_created", payload);
    return { roomId: round.id, serverSeedHash, clientSeed };
  });

  if (!out) {
    res.status(429).json({ error: "Lock busy" });
    return;
  }
  if ("error" in out) {
    res.status(400).json({ error: out.error });
    return;
  }
  res.json(out);
});

const joinSchema = z.object({
  userItemIds: z.array(z.string()).min(1),
  clientSeed: z.string().max(256).optional(),
});

router.post("/join/:roomId", requireAuth, requireCsrf, gameCreateLimiter, async (req: AuthedRequest, res) => {
  const roomId = singleRouteParam(req.params.roomId);
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { HOUSE_TAX_PERCENT } = getConfig();

  const result = await withLock(`coinflip-room:${roomId}`, 30, async () => {
    const round = await prisma.coinflipRound.findUnique({ where: { id: roomId } });
    if (!round || round.status !== CoinflipRoomStatus.open) return { error: "Room unavailable" as const };
    if (round.creatorId === req.userId) return { error: "Cannot join own room" as const };
    if (round.joinerId) return { error: "Room full" as const };
    if (round.expiresAt < new Date()) return { error: "Expired" as const };

    const items = await prisma.userItem.findMany({
      where: { userId: req.userId!, id: { in: parsed.data.userItemIds }, status: "deposited" },
    });
    if (items.length !== parsed.data.userItemIds.length) return { error: "Invalid items" as const };

    const creatorTotal = sumItems(
      (round.creatorItemsJson as unknown as { valueCoins: number }[])?.map((x) => ({ valueCoins: x.valueCoins })) ??
        [],
    );
    const joinerTotal = sumItems(items);
    const low = creatorTotal * 0.95;
    const high = creatorTotal * 1.05;
    if (joinerTotal < low || joinerTotal > high) return { error: "Value mismatch (±5%)" as const };

    await prisma.userItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { status: "in_game" },
    });

    const joinerItemsJson = items.map((i) => ({
      userItemId: i.id,
      itemName: i.itemName,
      thumb: i.robloxAssetId,
      valueCoins: Number(i.valueCoins),
    }));

    const joinerSeed = parsed.data.clientSeed ?? crypto.randomBytes(16).toString("hex");
    const combinedClientSeed = `${round.clientSeed ?? ""}:${joinerSeed}`;
    const nonce = round.nonce || round.id;
    const winnerIdx = coinflipWinnerIndex(round.serverSeed!, combinedClientSeed, nonce);
    const winnerId = winnerIdx === 0 ? round.creatorId : req.userId!;

    const tax = ((creatorTotal + joinerTotal) * HOUSE_TAX_PERCENT) / 100;

    const resultHash = sha256Hex(`${round.serverSeed}:${combinedClientSeed}:${nonce}:${winnerId}`);

    await prisma.coinflipRound.update({
      where: { id: roomId },
      data: {
        joinerId: req.userId!,
        joinerItemsJson,
        clientSeed: combinedClientSeed,
        winnerId,
        resultHash,
        taxAmount: tax,
        status: CoinflipRoomStatus.resolving,
        resolvedAt: new Date(),
      },
    });

    getIo()?.emit("coinflip:player_joined", { roomId, joinerId: req.userId });
    getIo()?.emit("coinflip:game_resolving", { roomId });

    const allItemIds = [
      ...(round.creatorItemsJson as unknown as { userItemId: string }[]).map((x) => x.userItemId),
      ...joinerItemsJson.map((x) => x.userItemId),
    ];

    await prisma.userItem.updateMany({
      where: { id: { in: allItemIds } },
      data: { userId: winnerId, status: "deposited" },
    });

    await prisma.coinflipRound.update({
      where: { id: roomId },
      data: { status: CoinflipRoomStatus.completed },
    });

    getIo()?.emit("coinflip:game_result", {
      roomId,
      winnerId,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: combinedClientSeed,
      nonce,
      resultHash,
      taxAmount: tax,
    });
    const wu = await prisma.user.findUnique({ where: { id: winnerId }, select: { username: true } });
    const potApprox = creatorTotal + joinerTotal - tax;
    getIo()?.emit("activity:new", {
      message: `🎰 ${wu?.username ?? "?"} won ${Math.round(potApprox).toLocaleString()} coins in Coinflip`,
      kind: "coinflip",
    });

    return {
      winnerId,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: combinedClientSeed,
      nonce,
      resultHash,
    };
  });

  if (!result) {
    res.status(429).json({ error: "Busy" });
    return;
  }
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.get("/rooms", async (_req, res) => {
  const rooms = await prisma.coinflipRound.findMany({
    where: { status: CoinflipRoomStatus.open, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { creator: true },
  });
  res.json({
    rooms: rooms.map((r) => ({
      id: r.id,
      creatorId: r.creatorId,
      stakeMode: r.stakeMode,
      creator: { username: r.creator.username, avatarUrl: r.creator.avatarUrl },
      creatorItemsJson: r.creatorItemsJson,
      creatorStakeCoins: r.creatorStakeCoins != null ? Number(r.creatorStakeCoins) : null,
      total:
        r.stakeMode === CoinflipStakeMode.coins
          ? Number(r.creatorStakeCoins ?? 0)
          : sumItems((r.creatorItemsJson as unknown as { valueCoins: number }[]) || []),
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      serverSeedHash: r.serverSeedHash,
    })),
  });
});

const createCoinsSchema = z.object({
  stakeCoins: z.number().positive(),
  clientSeed: z.string().max(256).optional(),
});

router.post("/create-coins", requireAuth, requireCsrf, gameCreateLimiter, async (req: AuthedRequest, res) => {
  const parsed = createCoinsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { COINFLIP_MIN_VALUE, COINFLIP_ROOM_MINUTES } = getConfig();
  const stake = parsed.data.stakeCoins;
  if (stake < COINFLIP_MIN_VALUE) {
    res.status(400).json({ error: `Minimum ${COINFLIP_MIN_VALUE} coins` });
    return;
  }

  const out = await withLock(`coinflip:${req.userId}`, 15, async () => {
    let roundId: string | null = null;
    try {
      const serverSeed = crypto.randomBytes(32).toString("hex");
      const serverSeedHash = sha256Hex(serverSeed);
      const clientSeed = parsed.data.clientSeed ?? crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + COINFLIP_ROOM_MINUTES * 60 * 1000);

      const round = await prisma.coinflipRound.create({
        data: {
          creatorId: req.userId!,
          stakeMode: CoinflipStakeMode.coins,
          creatorStakeCoins: new Prisma.Decimal(stake),
          creatorItemsJson: [],
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce: "",
          expiresAt,
          status: CoinflipRoomStatus.open,
          taxAmount: 0,
        },
      });
      roundId = round.id;
      await prisma.coinflipRound.update({
        where: { id: round.id },
        data: { nonce: round.id },
      });

      await subtractBalance(req.userId!, stake, LedgerEntryType.game_stake, {
        refType: "coinflip",
        refId: round.id,
        metadata: { mode: "coins" },
      });

      await writeAudit({
        userId: req.userId,
        action: "coinflip_create_coins",
        targetType: "coinflip_round",
        targetId: round.id,
        metadata: { stake },
      });

      getIo()?.emit("coinflip:room_created", {
        room: {
          id: round.id,
          creatorId: round.creatorId,
          stakeMode: "coins",
          creatorStakeCoins: stake,
          totalCreator: stake,
          totalJoiner: 0,
          serverSeedHash,
          clientSeed,
          expiresAt,
          status: round.status,
        },
      });

      return { roomId: round.id, serverSeedHash, clientSeed };
    } catch (e) {
      if (roundId) {
        await prisma.coinflipRound.delete({ where: { id: roundId } }).catch(() => {});
      }
      throw e;
    }
  });

  if (!out) {
    res.status(429).json({ error: "Lock busy" });
    return;
  }
  res.json(out);
});

const joinCoinsSchema = z.object({
  clientSeed: z.string().max(256).optional(),
});

router.post("/join-coins/:roomId", requireAuth, requireCsrf, gameCreateLimiter, async (req: AuthedRequest, res) => {
  const roomId = singleRouteParam(req.params.roomId);
  const parsed = joinCoinsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { HOUSE_TAX_PERCENT } = getConfig();

  const result = await withLock(`coinflip-room:${roomId}`, 30, async () => {
    const round = await prisma.coinflipRound.findUnique({ where: { id: roomId } });
    if (!round || round.status !== CoinflipRoomStatus.open) return { error: "Room unavailable" as const };
    if (round.stakeMode !== CoinflipStakeMode.coins) return { error: "Not a coin room" as const };
    if (round.creatorId === req.userId) return { error: "Cannot join own room" as const };
    if (round.joinerId) return { error: "Room full" as const };
    if (round.expiresAt < new Date()) return { error: "Expired" as const };

    const creatorTotal = Number(round.creatorStakeCoins ?? 0);
    const joinerTotal = creatorTotal;
    const low = creatorTotal * 0.95;
    const high = creatorTotal * 1.05;
    if (joinerTotal < low || joinerTotal > high) return { error: "Value mismatch (±5%)" as const };

    try {
      await subtractBalance(req.userId!, joinerTotal, LedgerEntryType.game_stake, {
        refType: "coinflip",
        refId: round.id,
        metadata: { mode: "coins_join" },
      });
    } catch {
      return { error: "Insufficient balance" as const };
    }

    const joinerSeed = parsed.data.clientSeed ?? crypto.randomBytes(16).toString("hex");
    const combinedClientSeed = `${round.clientSeed ?? ""}:${joinerSeed}`;
    const nonce = round.nonce || round.id;
    const winnerIdx = coinflipWinnerIndex(round.serverSeed!, combinedClientSeed, nonce);
    const winnerId = winnerIdx === 0 ? round.creatorId : req.userId!;

    const tax = ((creatorTotal + joinerTotal) * HOUSE_TAX_PERCENT) / 100;
    const pot = creatorTotal + joinerTotal - tax;

    const resultHash = sha256Hex(`${round.serverSeed}:${combinedClientSeed}:${nonce}:${winnerId}`);

    await prisma.coinflipRound.update({
      where: { id: roomId },
      data: {
        joinerId: req.userId!,
        joinerStakeCoins: new Prisma.Decimal(joinerTotal),
        joinerItemsJson: [],
        clientSeed: combinedClientSeed,
        winnerId,
        resultHash,
        taxAmount: tax,
        status: CoinflipRoomStatus.resolving,
        resolvedAt: new Date(),
      },
    });

    getIo()?.emit("coinflip:player_joined", { roomId, joinerId: req.userId });
    getIo()?.emit("coinflip:game_resolving", { roomId });

    try {
      await addBalance(winnerId, pot, LedgerEntryType.game_payout, {
        refType: "coinflip",
        refId: round.id,
        metadata: { tax },
      });
    } catch {
      /* critical */
    }

    await prisma.coinflipRound.update({
      where: { id: roomId },
      data: { status: CoinflipRoomStatus.completed },
    });

    await writeAudit({
      userId: winnerId,
      action: "coinflip_coin_winner",
      targetType: "coinflip_round",
      targetId: roomId,
      metadata: { pot, tax },
    });

    getIo()?.emit("coinflip:game_result", {
      roomId,
      winnerId,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: combinedClientSeed,
      nonce,
      resultHash,
      taxAmount: tax,
      stakeMode: "coins",
      pot,
    });
    const wuCoin = await prisma.user.findUnique({ where: { id: winnerId }, select: { username: true } });
    getIo()?.emit("activity:new", {
      message: `🎰 ${wuCoin?.username ?? "?"} won ${Math.round(pot).toLocaleString()} coins in Coinflip`,
      kind: "coinflip",
    });

    return {
      winnerId,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: combinedClientSeed,
      nonce,
      resultHash,
      pot,
      tax,
    };
  });

  if (!result) {
    res.status(429).json({ error: "Busy" });
    return;
  }
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.get("/history", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.coinflipRound.findMany({
    where: { OR: [{ creatorId: req.userId! }, { joinerId: req.userId! }] },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  res.json({ history: rows });
});

router.get("/round/:id", async (req, res) => {
  const id = singleRouteParam(req.params.id);
  const round = await prisma.coinflipRound.findUnique({
    where: { id },
    include: {
      creator: { select: { username: true } },
      joiner: { select: { username: true } },
      winner: { select: { username: true } },
    },
  });
  if (!round) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (round.status !== CoinflipRoomStatus.completed) {
    res.status(400).json({ error: "Round not resolved yet" });
    return;
  }
  res.json({
    id: round.id,
    status: round.status,
    serverSeed: round.serverSeed,
    serverSeedHash: round.serverSeedHash,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    resultHash: round.resultHash,
    winnerId: round.winnerId,
    creator: round.creator.username,
    joiner: round.joiner?.username ?? null,
    winner: round.winner?.username ?? null,
  });
});

export default router;
