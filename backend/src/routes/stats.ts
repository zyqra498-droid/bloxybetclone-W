import { Router } from "express";
import { CoinflipRoomStatus, JackpotRoundStatus, LedgerEntryType, TradeStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getConnectionCount } from "../socket/registry.js";

const router = Router();

function periodStart(period: "daily" | "weekly" | "alltime"): Date {
  const now = new Date();
  if (period === "alltime") return new Date(0);
  if (period === "weekly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get("/home", async (_req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [wageredAgg, openRooms, activeJackpot, catalogItemCount, catalogValueAgg] = await Promise.all([
    prisma.balanceLedger.aggregate({
      where: { createdAt: { gte: start }, entryType: LedgerEntryType.game_stake },
      _sum: { amount: true },
    }),
    prisma.coinflipRound.count({
      where: { status: CoinflipRoomStatus.open, expiresAt: { gt: new Date() } },
    }),
    prisma.jackpotRound.count({
      where: { status: { in: [JackpotRoundStatus.waiting, JackpotRoundStatus.active] } },
    }),
    prisma.itemValue.count(),
    prisma.itemValue.aggregate({ _sum: { valueCoins: true } }),
  ]);
  res.json({
    onlineUsers: getConnectionCount(),
    coinsWageredToday: Number(wageredAgg._sum.amount ?? 0),
    activeGames: openRooms + activeJackpot,
    catalogItemCount,
    catalogTotalValue: Number(catalogValueAgg._sum.valueCoins ?? 0),
  });
});

router.get("/leaderboard", async (req, res) => {
  const q = typeof req.query.period === "string" ? req.query.period : "daily";
  const period = q === "weekly" || q === "alltime" ? q : q === "all-time" ? "alltime" : "daily";
  const from = periodStart(period as "daily" | "weekly" | "alltime");

  const [stakes, winRows] = await Promise.all([
    prisma.balanceLedger.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: from }, entryType: LedgerEntryType.game_stake },
      _sum: { amount: true },
    }),
    prisma.balanceLedger.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: from }, entryType: LedgerEntryType.game_win },
      _count: { _all: true },
    }),
  ]);

  const stakeMap = new Map(stakes.map((s) => [s.userId, Number(s._sum.amount ?? 0)]));
  const winMap = new Map(winRows.map((w) => [w.userId, w._count._all]));
  const userIds = [...new Set([...stakes.map((s) => s.userId), ...winRows.map((w) => w.userId)])];
  if (userIds.length === 0) {
    res.json({ rows: [] });
    return;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, banned: false },
    select: { id: true, username: true, avatarUrl: true },
  });

  const rows = users
    .map((u) => ({
      userId: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      wagered: stakeMap.get(u.id) ?? 0,
      wins: winMap.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.wagered - a.wagered)
    .slice(0, 50);

  res.json({ rows });
});

router.get("/recent-trades", async (_req, res) => {
  const trades = await prisma.trade.findMany({
    where: { status: TradeStatus.ACCEPTED },
    orderBy: { completedAt: "desc" },
    take: 30,
    include: { user: { select: { username: true } } },
  });
  res.json({
    trades: trades.map((t) => ({
      id: t.id,
      direction: t.direction,
      username: t.user.username,
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
  });
});

export default router;
