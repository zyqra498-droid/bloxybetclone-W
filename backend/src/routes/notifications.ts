import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { getIo } from "../socket/registry.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ notifications: rows });
});

router.post("/read-all", requireAuth, requireCsrf, async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId!, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

router.post("/:id/read", requireAuth, requireCsrf, async (req: AuthedRequest, res) => {
  const raw = req.params.id;
  const id = typeof raw === "string" ? raw : raw?.[0];
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const n = await prisma.notification.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!n) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await prisma.notification.update({ where: { id }, data: { read: true } });
  getIo()?.to(`user:${req.userId!}`).emit("notification:read", { id });
  res.json({ ok: true });
});

export default router;
