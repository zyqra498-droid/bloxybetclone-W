import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { writeAudit } from "../services/auditLog.js";

const router = Router();

router.get("/public/:username", async (req: AuthedRequest, res) => {
  const username = typeof req.params.username === "string" ? req.params.username.trim() : "";
  if (username.length < 2) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, banned: false },
    select: {
      id: true,
      robloxId: true,
      username: true,
      avatarUrl: true,
      createdAt: true,
      balanceCoins: true,
      lockedCoins: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const wins = await prisma.balanceLedger.count({
    where: { userId: user.id, entryType: "game_win" },
  });
  const isSelf = req.userId === user.id;
  res.json({
    id: user.id,
    robloxId: user.robloxId,
    username: user.username,
    avatarUrl: user.avatarUrl,
    siteCreatedAt: user.createdAt.toISOString(),
    balanceCoins: isSelf ? Number(user.balanceCoins) : null,
    lockedCoins: isSelf ? Number(user.lockedCoins) : null,
    totalWins: wins,
    isSelf,
  });
});

const linkedBotSchema = z.object({
  botId: z.string().nullable(),
});

router.post("/me/linked-bot", requireAuth, requireCsrf, async (req: AuthedRequest, res) => {
  const parsed = linkedBotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { botId } = parsed.data;
  if (botId) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) {
      res.status(400).json({ error: "Unknown bot" });
      return;
    }
  }
  await prisma.user.update({
    where: { id: req.userId! },
    data: { linkedBotId: botId },
  });
  await writeAudit({
    userId: req.userId,
    actorId: req.userId,
    action: "linked_bot_set",
    targetType: "bot",
    targetId: botId ?? undefined,
    metadata: { botId },
  });
  res.json({ ok: true, linkedBotId: botId });
});

export default router;
