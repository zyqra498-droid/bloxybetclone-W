import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function writeAudit(input: {
  userId?: string | null;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? undefined,
      actorId: input.actorId ?? undefined,
      action: input.action,
      targetType: input.targetType ?? undefined,
      targetId: input.targetId ?? undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      ip: input.ip ?? undefined,
    },
  });
}
