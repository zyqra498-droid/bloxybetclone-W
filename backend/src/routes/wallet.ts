import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { TradeDirection } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/ledger", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.balanceLedger.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      balanceAfter: Number(r.balanceAfter),
      entryType: r.entryType,
      refType: r.refType,
      refId: r.refId,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.get("/deposits", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.trade.findMany({
    where: { userId: req.userId!, direction: TradeDirection.deposit },
    orderBy: { initiatedAt: "desc" },
    take: 100,
    include: { bot: { select: { id: true, robloxUsername: true } } },
  });
  res.json({
    deposits: rows.map((t) => ({
      id: t.id,
      status: t.status,
      itemsJson: t.itemsJson,
      initiatedAt: t.initiatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
      expiresAt: t.expiresAt?.toISOString() ?? null,
      robloxTradeId: t.robloxTradeId,
      matchedSenderName: t.matchedSenderName,
      failureReason: t.failureReason,
      bot: t.bot,
    })),
  });
});

router.get("/withdrawals", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.trade.findMany({
    where: { userId: req.userId!, direction: TradeDirection.withdraw },
    orderBy: { initiatedAt: "desc" },
    take: 100,
    include: { bot: { select: { id: true, robloxUsername: true } } },
  });
  res.json({
    withdrawals: rows.map((t) => ({
      id: t.id,
      status: t.status,
      itemsJson: t.itemsJson,
      initiatedAt: t.initiatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
      expiresAt: t.expiresAt?.toISOString() ?? null,
      robloxTradeId: t.robloxTradeId,
      failureReason: t.failureReason,
      bot: t.bot,
    })),
  });
});

router.get("/summary", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { balanceCoins: true, lockedCoins: true },
  });
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    balanceCoins: Number(user.balanceCoins),
    lockedCoins: Number(user.lockedCoins),
    availableCoins: Number(user.balanceCoins) - Number(user.lockedCoins),
  });
});

export default router;
