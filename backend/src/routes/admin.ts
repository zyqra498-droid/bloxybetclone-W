import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { Prisma, LedgerEntryType } from "@prisma/client";
import { addBalance, subtractBalance } from "../services/walletService.js";
import { parseItemValuesCsv } from "../lib/parseItemValuesCsv.js";
import { searchCatalogAssets } from "../services/robloxApi.js";

const CATALOG_SEARCH_ALLOWED = new Set([10, 28, 30, 50, 60, 100, 120]);

const router = Router();

router.get("/audit-logs", requireAdmin, async (req, res) => {
  const take = Math.min(200, Math.max(1, Number(req.query.take) || 80));
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
  res.json({
    logs: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      actorId: r.actorId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.get("/users", requireAdmin, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const users = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: q, mode: "insensitive" } }, { robloxId: { contains: q } }],
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  res.json({ users });
});

router.get("/trades", requireAdmin, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const trades = await prisma.trade.findMany({
    where: status ? { status: status as never } : {},
    take: 100,
    orderBy: { initiatedAt: "desc" },
    include: { user: true, bot: true },
  });
  res.json({ trades });
});

const itemValueSchema = z.object({
  robloxAssetId: z.string(),
  /** Numeric Roblox catalog limited id — set for real withdrawals when robloxAssetId is a site slug (e.g. limited-*). */
  robloxCatalogAssetId: z.union([z.string().regex(/^\d+$/), z.null()]).optional(),
  itemName: z.string(),
  gameSource: z.string(),
  valueCoins: z.number().nonnegative(),
});

router.post("/set-item-value", requireAdmin, requireCsrf, async (req, res) => {
  const parsed = itemValueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.itemValue.findUnique({
    where: { robloxAssetId: parsed.data.robloxAssetId },
  });
  const row = await prisma.itemValue.upsert({
    where: { robloxAssetId: parsed.data.robloxAssetId },
    create: {
      robloxAssetId: parsed.data.robloxAssetId,
      itemName: parsed.data.itemName,
      gameSource: parsed.data.gameSource,
      valueCoins: new Prisma.Decimal(parsed.data.valueCoins),
      ...(parsed.data.robloxCatalogAssetId !== undefined
        ? { robloxCatalogAssetId: parsed.data.robloxCatalogAssetId }
        : {}),
    },
    update: {
      itemName: parsed.data.itemName,
      gameSource: parsed.data.gameSource,
      valueCoins: new Prisma.Decimal(parsed.data.valueCoins),
      ...(parsed.data.robloxCatalogAssetId !== undefined
        ? { robloxCatalogAssetId: parsed.data.robloxCatalogAssetId }
        : {}),
    },
  });
  if (existing) {
    await prisma.itemValueHistory.create({
      data: {
        robloxAssetId: parsed.data.robloxAssetId,
        oldValue: existing.valueCoins,
        newValue: row.valueCoins,
        adminId: (req as { userId?: string }).userId,
      },
    });
  }
  res.json({ ok: true, item: row });
});

const banSchema = z.object({
  userId: z.string(),
  banned: z.boolean(),
  banReason: z.string().optional(),
});

router.post("/ban-user", requireAdmin, requireCsrf, async (req, res) => {
  const parsed = banSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { banned: parsed.data.banned, banReason: parsed.data.banReason },
  });
  await prisma.adminLog.create({
    data: {
      adminId: (req as { userId?: string }).userId!,
      action: "ban_user",
      targetUserId: parsed.data.userId,
      detailsJson: parsed.data,
    },
  });
  res.json({ ok: true });
});

router.get("/item-values", requireAdmin, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const take = Math.min(1000, Math.max(1, Number(req.query.take) || 500));
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const where =
    q.length > 0
      ? {
          OR: [
            { robloxAssetId: { contains: q, mode: "insensitive" as const } },
            { itemName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  const [items, total] = await Promise.all([
    prisma.itemValue.findMany({
      where,
      orderBy: [{ gameSource: "asc" }, { itemName: "asc" }],
      take,
      skip,
    }),
    prisma.itemValue.count({ where }),
  ]);

  res.json({
    items: items.map((r) => ({
      id: r.id,
      robloxAssetId: r.robloxAssetId,
      robloxCatalogAssetId: r.robloxCatalogAssetId,
      itemName: r.itemName,
      gameSource: r.gameSource,
      valueCoins: Number(r.valueCoins),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total,
    take,
    skip,
  });
});

/** Keyword search on Roblox catalog (official API). Use results to fill robloxCatalogAssetId — always verify limited vs accessory. */
router.get("/roblox-catalog-search", requireAdmin, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const lim = Number(req.query.limit) || 30;
  const limit = CATALOG_SEARCH_ALLOWED.has(lim) ? lim : 30;
  if (q.length < 2) {
    res.status(400).json({ error: "Enter at least 2 characters to search." });
    return;
  }
  if (q.length > 200) {
    res.status(400).json({ error: "Query too long (max 200 characters)." });
    return;
  }
  try {
    const hits = await searchCatalogAssets(q, limit);
    res.json({
      query: q,
      hits: hits.map((h) => ({
        id: String(h.id),
        name: h.name,
        itemType: h.itemType,
        catalogUrl: h.catalogUrl,
      })),
    });
  } catch (e) {
    console.warn("[admin] roblox-catalog-search", e);
    res.status(502).json({ error: "Roblox catalog search failed. Try again later." });
  }
});

const importItemValuesCsvSchema = z.object({
  csv: z.string().max(3_500_000),
  dryRun: z.boolean().optional(),
});

router.post("/import-item-values-csv", requireAdmin, requireCsrf, async (req, res) => {
  const parsed = importItemValuesCsvSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { rows, errors: parseErrors } = parseItemValuesCsv(parsed.data.csv);
  const errors: { line: number; message: string }[] = [...parseErrors];

  if (parsed.data.dryRun) {
    res.json({
      ok: true,
      dryRun: true,
      wouldUpsert: rows.length,
      parseErrors: errors,
    });
    return;
  }

  const fatalParseErrors = errors.filter((e) => !e.message.includes("Only first"));
  if (fatalParseErrors.length > 0) {
    res.status(400).json({
      ok: false,
      error: "CSV has validation errors",
      parseErrors: fatalParseErrors,
    });
    return;
  }

  let upserted = 0;
  try {
    for (const r of rows) {
      const catalogPart =
        r.robloxCatalogAssetId === "omit"
          ? {}
          : { robloxCatalogAssetId: r.robloxCatalogAssetId as string | null };

      await prisma.itemValue.upsert({
        where: { robloxAssetId: r.robloxAssetId },
        create: {
          robloxAssetId: r.robloxAssetId,
          itemName: r.itemName,
          gameSource: r.gameSource,
          valueCoins: new Prisma.Decimal(r.valueCoins),
          ...catalogPart,
        },
        update: {
          itemName: r.itemName,
          gameSource: r.gameSource,
          valueCoins: new Prisma.Decimal(r.valueCoins),
          ...catalogPart,
        },
      });
      upserted += 1;
    }
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "Import failed",
      upserted,
      parseErrors: errors,
    });
    return;
  }

  const adminId = (req as { userId?: string }).userId!;
  await prisma.adminLog.create({
    data: {
      adminId,
      action: "import_item_values_csv",
      detailsJson: { upserted, truncatedNotice: errors.find((e) => e.line === 0)?.message },
    },
  });

  res.json({ ok: true, upserted, parseWarnings: errors.filter((e) => e.line === 0) });
});

router.get("/revenue-stats", requireAdmin, async (_req, res) => {
  const users = await prisma.user.count();
  const vol = await prisma.coinflipRound.aggregate({ _sum: { taxAmount: true } });
  res.json({
    totalUsers: users,
    coinflipTax: vol._sum.taxAmount ? Number(vol._sum.taxAmount) : 0,
  });
});

const houseSchema = z.object({
  jackpotMinDeposit: z.number().optional(),
  coinflipMinValue: z.number().optional(),
  houseTaxPercent: z.number().optional(),
});

const adjustBalanceSchema = z.object({
  userId: z.string(),
  deltaCoins: z.number(),
  note: z.string().max(500).optional(),
});

router.post("/adjust-balance", requireAdmin, requireCsrf, async (req, res) => {
  const parsed = adjustBalanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { userId, deltaCoins, note } = parsed.data;
  const adminId = (req as { userId?: string }).userId!;
  try {
    if (deltaCoins > 0) {
      await addBalance(userId, deltaCoins, LedgerEntryType.admin_adjust, {
        refType: "admin",
        refId: adminId,
        metadata: { note },
      });
    } else if (deltaCoins < 0) {
      await subtractBalance(userId, -deltaCoins, LedgerEntryType.admin_adjust, {
        refType: "admin",
        refId: adminId,
        metadata: { note },
      });
    }
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Adjust failed" });
    return;
  }
  await prisma.adminLog.create({
    data: {
      adminId,
      action: "adjust_balance",
      targetUserId: userId,
      detailsJson: { deltaCoins, note },
    },
  });
  res.json({ ok: true });
});

router.post("/configure-house-edge", requireAdmin, requireCsrf, async (req, res) => {
  const parsed = houseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  const data = { ...(existing?.data as object), ...parsed.data };
  await prisma.siteConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", data },
    update: { data },
  });
  res.json({ ok: true });
});

export default router;
