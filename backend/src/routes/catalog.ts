import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/item-values", async (_req, res) => {
  const rows = await prisma.itemValue.findMany({
    orderBy: { itemName: "asc" },
    take: 2000,
  });
  res.json({
    items: rows.map((r) => ({
      robloxAssetId: r.robloxAssetId,
      itemName: r.itemName,
      gameSource: r.gameSource,
      valueCoins: Number(r.valueCoins),
      robloxCatalogAssetId: r.robloxCatalogAssetId,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

router.get("/item-values/:robloxAssetId/history", async (req, res) => {
  const robloxAssetId = req.params.robloxAssetId;
  const rows = await prisma.itemValueHistory.findMany({
    where: { robloxAssetId },
    orderBy: { createdAt: "asc" },
    take: 60,
  });
  const current = await prisma.itemValue.findUnique({ where: { robloxAssetId } });
  const points = rows.map((r) => ({
    date: r.createdAt.toISOString(),
    value: Number(r.newValue),
  }));
  if (current && points.length === 0) {
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      points.push({ date: d.toISOString(), value: Number(current.valueCoins) });
    }
  }
  res.json({ points });
});

export default router;
