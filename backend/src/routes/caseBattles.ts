import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { CaseBattleStatus } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { singleRouteParam } from "../lib/param.js";

const router = Router();

router.get("/cases", async (_req, res) => {
  const cases = await prisma.caseDefinition.findMany({ orderBy: { name: "asc" } });
  res.json({ cases });
});

router.get("/list", async (_req, res) => {
  const rows = await prisma.caseBattleRound.findMany({
    where: { status: CaseBattleStatus.lobby },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      caseDef: { select: { id: true, name: true, slug: true } },
      players: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });
  res.json({
    battles: rows.map((b) => ({
      id: b.id,
      status: b.status,
      maxPlayers: b.maxPlayers,
      createdAt: b.createdAt.toISOString(),
      case: b.caseDef,
      players: b.players.map((p) => ({
        userId: p.userId,
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
        joinedAt: p.joinedAt.toISOString(),
      })),
    })),
  });
});

const createBattleSchema = z.object({
  caseId: z.string(),
  maxPlayers: z.number().min(2).max(4).default(2),
});

router.post("/create", requireAuth, requireCsrf, async (req: AuthedRequest, res) => {
  const parsed = createBattleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const battle = await prisma.caseBattleRound.create({
    data: {
      caseId: parsed.data.caseId,
      maxPlayers: parsed.data.maxPlayers,
      status: CaseBattleStatus.lobby,
      players: {
        create: { userId: req.userId! },
      },
    },
  });
  res.json({ battleId: battle.id });
});

router.post("/join/:battleId", requireAuth, requireCsrf, async (req: AuthedRequest, res) => {
  const battleId = singleRouteParam(req.params.battleId);
  const battle = await prisma.caseBattleRound.findUnique({
    where: { id: battleId },
    include: { players: true },
  });
  if (!battle || battle.status !== CaseBattleStatus.lobby) {
    res.status(400).json({ error: "Battle not joinable" });
    return;
  }
  const existing = battle.players.find((p) => p.userId === req.userId!);
  if (!existing && battle.players.length >= battle.maxPlayers) {
    res.status(400).json({ error: "Lobby is full" });
    return;
  }
  if (!existing) {
    await prisma.caseBattleParticipant.create({
      data: { battleId, userId: req.userId! },
    });
  }
  res.json({ ok: true });
});

router.get("/:battleId", async (req, res) => {
  const battleId = singleRouteParam(req.params.battleId);
  const b = await prisma.caseBattleRound.findUnique({
    where: { id: battleId },
    include: {
      caseDef: { select: { id: true, name: true, slug: true, poolJson: true } },
      players: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!b) {
    res.status(404).json({ error: "Battle not found" });
    return;
  }
  res.json({
    battle: {
      id: b.id,
      status: b.status,
      maxPlayers: b.maxPlayers,
      serverSeedHash: b.serverSeedHash,
      resultHash: b.resultHash,
      winnerUserId: b.winnerUserId,
      createdAt: b.createdAt.toISOString(),
      resolvedAt: b.resolvedAt?.toISOString() ?? null,
      case: b.caseDef,
      players: b.players.map((p) => ({
        userId: p.userId,
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
        joinedAt: p.joinedAt.toISOString(),
        rollJson: p.rollJson,
      })),
    },
  });
});

export default router;
