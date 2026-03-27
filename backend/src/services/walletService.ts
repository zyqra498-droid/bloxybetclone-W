import { Prisma, LedgerEntryType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

function d(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

export async function addBalance(
  userId: string,
  amount: number,
  entryType: LedgerEntryType,
  ref?: { refType: string; refId: string; metadata?: Record<string, unknown> },
): Promise<void> {
  if (amount <= 0 || !Number.isFinite(amount)) throw new Error("Invalid amount");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const next = d(Number(user.balanceCoins) + amount);
    await tx.user.update({
      where: { id: userId },
      data: { balanceCoins: next },
    });
    await tx.balanceLedger.create({
      data: {
        userId,
        amount: d(amount),
        balanceAfter: next,
        entryType,
        refType: ref?.refType,
        refId: ref?.refId,
        metadata: ref?.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  });
}

export async function subtractBalance(
  userId: string,
  amount: number,
  entryType: LedgerEntryType,
  ref?: { refType: string; refId: string; metadata?: Record<string, unknown> },
): Promise<void> {
  if (amount <= 0 || !Number.isFinite(amount)) throw new Error("Invalid amount");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const avail = Number(user.balanceCoins) - Number(user.lockedCoins);
    if (avail < amount) throw new Error("Insufficient balance");
    const next = d(Number(user.balanceCoins) - amount);
    await tx.user.update({
      where: { id: userId },
      data: { balanceCoins: next },
    });
    await tx.balanceLedger.create({
      data: {
        userId,
        amount: d(-amount),
        balanceAfter: next,
        entryType,
        refType: ref?.refType,
        refId: ref?.refId,
        metadata: ref?.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  });
}

export async function lockBalance(userId: string, amount: number): Promise<void> {
  if (amount <= 0 || !Number.isFinite(amount)) throw new Error("Invalid amount");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const avail = Number(user.balanceCoins) - Number(user.lockedCoins);
    if (avail < amount) throw new Error("Insufficient available balance");
    const locked = d(Number(user.lockedCoins) + amount);
    await tx.user.update({
      where: { id: userId },
      data: { lockedCoins: locked },
    });
    await tx.balanceLedger.create({
      data: {
        userId,
        amount: d(0),
        balanceAfter: user.balanceCoins,
        entryType: LedgerEntryType.lock,
        refType: "lock",
        metadata: { lockedDelta: amount } as Prisma.InputJsonValue,
      },
    });
  });
}

export async function unlockBalance(userId: string, amount: number): Promise<void> {
  if (amount <= 0 || !Number.isFinite(amount)) throw new Error("Invalid amount");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (Number(user.lockedCoins) < amount) throw new Error("Insufficient locked balance");
    const locked = d(Number(user.lockedCoins) - amount);
    await tx.user.update({
      where: { id: userId },
      data: { lockedCoins: locked },
    });
    await tx.balanceLedger.create({
      data: {
        userId,
        amount: d(0),
        balanceAfter: user.balanceCoins,
        entryType: LedgerEntryType.unlock,
        refType: "unlock",
        metadata: { unlockedDelta: amount } as Prisma.InputJsonValue,
      },
    });
  });
}
