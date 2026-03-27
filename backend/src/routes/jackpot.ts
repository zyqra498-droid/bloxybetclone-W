import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { JackpotRoundStatus } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { gameCreateLimiter } from "../middleware/rateLimits.js";
import { getConfig } from "../config.js";
import { getIo } from "../socket/registry.js";
import { withLock } from "../lib/redisLock.js";
import { getOrCreateActiveRound, resolveJackpotRound } from "../services/jackpotEngine.js";
import { LedgerEntryType } from "@prisma/client";
import { subtractBalance } from "../services/walletService.js";
import { writeAudit } from "../services/auditLog.js";
import { singleRouteParam } from "../lib/param.js";

const router = Router();

const depositSchema = z.object({
  userItemIds: z.array(z.string()).min(1),
});

router.post("/deposit", requireAuth, requireCsrf, gameCreateLimiter, async (req: AuthedRequest, res) => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { JACKPOT_MIN_DEPOSIT, JACKPOT_MAX_POT } = getConfig();

  const result = await withLock("jackpot:global", 20, async () => {
    const round = await getOrCreateActiveRound();
    if (!round) return { error: "No round" as const };
    if (round.endsAt && round.endsAt < new Date()) return { error: "Round ended" as const };

    const items = await prisma.userItem.findMany({
      where: { userId: req.userId!, id: { in: parsed.data.userItemIds }, status: "deposited" },
    });
    if (items.length !== parsed.data.userItemIds.length) return { error: "Invalid items" as const };

    const value = items.reduce((s, i) => s + Number(i.valueCoins), 0);
    if (value < JACKPOT_MIN_DEPOSIT) return { error: `Min ${JACKPOT_MIN_DEPOSIT}` as const };

    const newTotal = Number(round.totalValue) + value;
    if (newTotal > JACKPOT_MAX_POT) return { error: "Pot cap reached" as const };

    await prisma.userItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { status: "in_game" },
    });

    const ticketStart = round.totalTickets;
    const valueInt = BigInt(Math.floor(value * 1000));
    const ticketEnd = ticketStart + valueInt - 1n;

    await prisma.jackpotEntry.create({
      data: {
        roundId: round.id,
        userId: req.userId!,
        itemsJson: items.map((i) => ({
          userItemId: i.id,
          itemName: i.itemName,
          valueCoins: Number(i.valueCoins),
        })),
        valueCoins: value,
        ticketStart,
        ticketEnd,
      },
    });

    const updated = await prisma.jackpotRound.update({
      where: { id: round.id },
      data: {
        totalValue: newTotal,
        totalTickets: round.totalTickets + valueInt,
        status: JackpotRoundStatus.active,
      },
    });

    getIo()?.emit("jackpot:item_deposited", {
      roundId: round.id,
      userId: req.userId,
      value,
      totalValue: Number(updated.totalValue),
    });
    getIo()?.emit("jackpot:pot_update", {
      roundId: round.id,
      totalValue: Number(updated.totalValue),
      totalTickets: updated.totalTickets.toString(),
    });

    if (newTotal >= JACKPOT_MAX_POT) {
      await resolveJackpotRound(round.id);
    }

    return { ok: true, roundId: round.id };
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

const depositCoinsSchema = z.object({
  coinAmount: z.number().positive(),
});

router.post("/deposit-coins", requireAuth, requireCsrf, gameCreateLimiter, async (req: AuthedRequest, res) => {
  const parsed = depositCoinsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { JACKPOT_MIN_DEPOSIT, JACKPOT_MAX_POT } = getConfig();
  const value = parsed.data.coinAmount;
  if (value < JACKPOT_MIN_DEPOSIT) {
    res.status(400).json({ error: `Min ${JACKPOT_MIN_DEPOSIT}` });
    return;
  }

  const result = await withLock("jackpot:global", 20, async () => {
    const round = await getOrCreateActiveRound();
    if (!round) return { error: "No round" as const };
    if (round.endsAt && round.endsAt < new Date()) return { error: "Round ended" as const };

    const newTotal = Number(round.totalValue) + value;
    if (newTotal > JACKPOT_MAX_POT) return { error: "Pot cap reached" as const };

    try {
      await subtractBalance(req.userId!, value, LedgerEntryType.game_stake, {
        refType: "jackpot",
        refId: round.id,
        metadata: { coinOnly: true },
      });
    } catch {
      return { error: "Insufficient balance" as const };
    }

    const ticketStart = round.totalTickets;
    const valueInt = BigInt(Math.floor(value * 1000));
    const ticketEnd = ticketStart + valueInt - 1n;

    await prisma.jackpotEntry.create({
      data: {
        roundId: round.id,
        userId: req.userId!,
        itemsJson: [],
        valueCoins: value,
        ticketStart,
        ticketEnd,
      },
    });

    const updated = await prisma.jackpotRound.update({
      where: { id: round.id },
      data: {
        totalValue: newTotal,
        totalTickets: round.totalTickets + valueInt,
        status: JackpotRoundStatus.active,
      },
    });

    await writeAudit({
      userId: req.userId,
      action: "jackpot_deposit_coins",
      targetType: "jackpot_round",
      targetId: round.id,
      metadata: { value },
    });

    getIo()?.emit("jackpot:item_deposited", {
      roundId: round.id,
      userId: req.userId,
      value,
      totalValue: Number(updated.totalValue),
    });
    getIo()?.emit("jackpot:pot_update", {
      roundId: round.id,
      totalValue: Number(updated.totalValue),
      totalTickets: updated.totalTickets.toString(),
    });

    if (newTotal >= JACKPOT_MAX_POT) {
      await resolveJackpotRound(round.id);
    }

    return { ok: true, roundId: round.id };
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

router.get("/current-round", async (_req, res) => {
  await getOrCreateActiveRound();
  const round = await prisma.jackpotRound.findFirst({
    where: {
      status: { in: [JackpotRoundStatus.waiting, JackpotRoundStatus.active] },
      serverSeed: { not: null },
    },
    orderBy: { startedAt: "desc" },
    include: {
      entries: { include: { user: true } },
    },
  });
  if (!round) {
    res.json({ round: null });
    return;
  }
  const total = Number(round.totalValue);
  res.json({
    round: {
      id: round.id,
      status: round.status,
      totalValue: total,
      totalTickets: round.totalTickets.toString(),
      serverSeedHash: round.serverSeedHash,
      endsAt: round.endsAt,
      entries: round.entries.map((e) => ({
        userId: e.userId,
        username: e.user.username,
        avatarUrl: e.user.avatarUrl,
        valueCoins: Number(e.valueCoins),
        chance: total > 0 ? Number(e.valueCoins) / total : 0,
        itemsJson: e.itemsJson,
      })),
    },
  });
});

router.get("/history", async (_req, res) => {
  const rows = await prisma.jackpotRound.findMany({
    where: { status: JackpotRoundStatus.completed },
    orderBy: { resolvedAt: "desc" },
    take: 10,
    include: { winner: true },
  });
  res.json({
    history: rows.map((r) => ({
      id: r.id,
      winner: r.winner ? { username: r.winner.username, avatarUrl: r.winner.avatarUrl } : null,
      totalValue: Number(r.totalValue),
      resolvedAt: r.resolvedAt,
      resultHash: r.resultHash,
    })),
  });
});

router.get("/round/:id", async (req, res) => {
  const id = singleRouteParam(req.params.id);
  const round = await prisma.jackpotRound.findUnique({
    where: { id },
    include: { winner: { select: { username: true } } },
  });
  if (!round) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (round.status !== JackpotRoundStatus.completed) {
    res.status(400).json({ error: "Round not completed" });
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
    winningTicket: round.winningTicket?.toString(),
    totalTickets: round.totalTickets.toString(),
    totalValue: Number(round.totalValue),
    winnerUsername: round.winner?.username ?? null,
  });
});

export default router;
