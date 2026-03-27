import { CoinflipRoomStatus, CoinflipStakeMode, LedgerEntryType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { addBalance } from "./walletService.js";
import { writeAudit } from "./auditLog.js";

/** Refund creator stake for expired coinflip rooms that never got a joiner. */
export async function refundExpiredCoinflipCoinRooms(): Promise<number> {
  const now = new Date();
  const expired = await prisma.coinflipRound.findMany({
    where: {
      status: CoinflipRoomStatus.open,
      stakeMode: CoinflipStakeMode.coins,
      expiresAt: { lt: now },
      joinerId: null,
    },
  });

  let n = 0;
  for (const r of expired) {
    const stake = r.creatorStakeCoins ? Number(r.creatorStakeCoins) : 0;
    if (stake <= 0) {
      await prisma.coinflipRound.update({
        where: { id: r.id },
        data: { status: CoinflipRoomStatus.expired },
      });
      continue;
    }
    try {
      await addBalance(r.creatorId, stake, LedgerEntryType.stake_refund, {
        refType: "coinflip",
        refId: r.id,
        metadata: { reason: "expired_no_joiner" },
      });
      await prisma.coinflipRound.update({
        where: { id: r.id },
        data: { status: CoinflipRoomStatus.expired },
      });
      await writeAudit({
        userId: r.creatorId,
        action: "coinflip_coin_refund",
        targetType: "coinflip_round",
        targetId: r.id,
        metadata: { stake },
      });
      n += 1;
    } catch {
      /* ignore row */
    }
  }
  return n;
}

export function startCoinflipCoinExpireScheduler(): void {
  setInterval(() => {
    void refundExpiredCoinflipCoinRooms();
  }, 60_000);
}
