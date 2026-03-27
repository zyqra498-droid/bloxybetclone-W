import { prisma } from "../lib/prisma.js";
import { BotPoolStatus } from "@prisma/client";

export async function pickIdleBot(userId?: string, assignedGame?: string): Promise<string | null> {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { linkedBotId: true },
    });
    if (user?.linkedBotId) {
      const preferred = await prisma.bot.findFirst({
        where: {
          id: user.linkedBotId,
          status: BotPoolStatus.idle,
          ...(assignedGame ? { assignedGame } : {}),
        },
      });
      if (preferred) return preferred.id;
    }
  }

  const bot = await prisma.bot.findFirst({
    where: {
      status: BotPoolStatus.idle,
      ...(assignedGame ? { assignedGame } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  return bot?.id ?? null;
}
