import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { JackpotRoundStatus, LedgerEntryType } from "@prisma/client";
import { addBalance } from "./walletService.js";
import { getConfig } from "../config.js";
import { sha256Hex, jackpotWinningTicket } from "../lib/provablyFair.js";
import { getIo } from "../socket/registry.js";

export async function createSeededRound() {
  const { JACKPOT_ROUND_SECONDS } = getConfig();
  const serverSeed = crypto.randomBytes(32).toString("hex");
  const serverSeedHash = sha256Hex(serverSeed);
  const clientSeed = crypto.randomBytes(16).toString("hex");
  const endsAt = new Date(Date.now() + JACKPOT_ROUND_SECONDS * 1000);
  let round = await prisma.jackpotRound.create({
    data: {
      status: JackpotRoundStatus.active,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce: "pending",
      startedAt: new Date(),
      endsAt,
    },
  });
  round = await prisma.jackpotRound.update({
    where: { id: round.id },
    data: { nonce: round.id },
  });
  getIo()?.emit("jackpot:new_round_started", { roundId: round.id, serverSeedHash, endsAt });
  return round;
}

export async function getOrCreateActiveRound() {
  const round = await prisma.jackpotRound.findFirst({
    where: {
      status: { in: [JackpotRoundStatus.waiting, JackpotRoundStatus.active] },
      serverSeed: { not: null },
    },
    orderBy: { startedAt: "desc" },
  });
  if (round) return round;
  return createSeededRound();
}

export async function resolveJackpotRound(roundId: string): Promise<void> {
  const round = await prisma.jackpotRound.findUnique({
    where: { id: roundId },
    include: { entries: true },
  });
  if (!round || round.entries.length === 0) return;

  const nonce = round.nonce || roundId;
  const winTicket = jackpotWinningTicket(
    round.serverSeed!,
    round.clientSeed!,
    nonce,
    round.totalTickets > 0n ? round.totalTickets : 1n,
  );

  let winnerEntry = round.entries[0]!;
  for (const e of round.entries) {
    if (winTicket >= e.ticketStart && winTicket <= e.ticketEnd) {
      winnerEntry = e;
      break;
    }
  }

  const winnerId = winnerEntry.userId;
  const allItems = await prisma.jackpotEntry.findMany({ where: { roundId } });
  const allUserItemIds = allItems.flatMap((e) => {
    const arr = e.itemsJson as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return (arr as { userItemId: string }[]).map((x) => x.userItemId);
  });

  if (allUserItemIds.length > 0) {
    await prisma.userItem.updateMany({
      where: { id: { in: allUserItemIds } },
      data: { userId: winnerId, status: "deposited" },
    });
  }

  let coinPot = 0;
  for (const e of round.entries) {
    const arr = e.itemsJson as unknown;
    if (Array.isArray(arr) && arr.length === 0) {
      coinPot += Number(e.valueCoins);
    }
  }
  if (coinPot > 0) {
    await addBalance(winnerId, coinPot, LedgerEntryType.game_payout, {
      refType: "jackpot",
      refId: roundId,
      metadata: { source: "coin_entries" },
    });
  }

  const resultHash = sha256Hex(`${round.serverSeed}:${round.clientSeed}:${nonce}:${winnerId}:${winTicket}`);

  await prisma.jackpotRound.update({
    where: { id: roundId },
    data: {
      status: JackpotRoundStatus.completed,
      winnerId,
      winningTicket: winTicket,
      resultHash,
      resolvedAt: new Date(),
    },
  });

  getIo()?.emit("jackpot:resolving", { roundId });
  getIo()?.emit("jackpot:winner_selected", {
    roundId,
    winnerId,
    winningTicket: winTicket.toString(),
    serverSeed: round.serverSeed,
    serverSeedHash: round.serverSeedHash,
    clientSeed: round.clientSeed,
    resultHash,
  });
  const winUser = await prisma.user.findUnique({ where: { id: winnerId }, select: { username: true } });
  getIo()?.emit("activity:new", {
    message: `🎰 ${winUser?.username ?? "?"} won ${Math.round(Number(round.totalValue)).toLocaleString()} coins in Jackpot`,
    kind: "jackpot",
  });

  await createSeededRound();
}
