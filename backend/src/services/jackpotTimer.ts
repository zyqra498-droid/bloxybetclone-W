import { prisma } from "../lib/prisma.js";
import { JackpotRoundStatus } from "@prisma/client";
import { resolveJackpotRound } from "./jackpotEngine.js";
import { getIo } from "../socket/registry.js";

export function startJackpotTimer(): NodeJS.Timeout {
  return setInterval(async () => {
    const now = new Date();
    const due = await prisma.jackpotRound.findMany({
      where: {
        status: JackpotRoundStatus.active,
        endsAt: { lte: now },
        totalTickets: { gt: 0n },
      },
    });
    for (const r of due) {
      await resolveJackpotRound(r.id);
      getIo()?.emit("jackpot:timer_update", { roundId: r.id, remainingSec: 0 });
    }
  }, 5000);
}
