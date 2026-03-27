import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { BotPoolStatus } from "@prisma/client";
import { requireAdmin } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { encryptString } from "../lib/cryptoUtil.js";
import { singleRouteParam } from "../lib/param.js";

const router = Router();

router.get("/status", requireAdmin, async (_req, res) => {
  const bots = await prisma.bot.findMany({ orderBy: { createdAt: "asc" } });
  res.json({
    bots: bots.map((b) => ({
      id: b.id,
      robloxUsername: b.robloxUsername,
      status: b.status,
      assignedGame: b.assignedGame,
      currentTradeId: b.currentTradeId,
      createdAt: b.createdAt,
    })),
  });
});

const addSchema = z.object({
  robloxUsername: z.string().min(1),
  robloxUserId: z.string().optional(),
  robloxCookie: z.string().min(10),
  assignedGame: z.string().optional(),
});

router.post("/add-bot", requireAdmin, requireCsrf, async (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const enc = encryptString(parsed.data.robloxCookie);
  const bot = await prisma.bot.create({
    data: {
      robloxUsername: parsed.data.robloxUsername,
      robloxUserId: parsed.data.robloxUserId,
      robloxCookieEncrypted: enc,
      status: BotPoolStatus.idle,
      assignedGame: parsed.data.assignedGame,
    },
  });
  res.json({ id: bot.id });
});

router.post("/remove-bot/:botId", requireAdmin, requireCsrf, async (req, res) => {
  const botId = singleRouteParam(req.params.botId);
  await prisma.bot.delete({ where: { id: botId } });
  res.json({ ok: true });
});

export default router;
