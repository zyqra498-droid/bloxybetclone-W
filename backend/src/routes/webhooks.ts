import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getConfig } from "../config.js";
import { hmacMemo } from "../lib/cryptoUtil.js";

const router = Router();

const payloadSchema = z.object({
  tradeId: z.string(),
  robloxTradeId: z.string(),
  status: z.enum(["accepted", "declined"]),
  signature: z.string(),
});

router.post("/trade", async (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid" });
    return;
  }
  const secret = getConfig().TRADE_HMAC_SECRET;
  const expected = crypto.createHmac("sha256", secret).update(parsed.data.tradeId + parsed.data.status).digest("hex");
  if (expected !== parsed.data.signature) {
    res.status(401).json({ error: "bad signature" });
    return;
  }

  const trade = await prisma.trade.findUnique({ where: { id: parsed.data.tradeId } });
  if (!trade) {
    res.status(400).json({ error: "unknown trade" });
    return;
  }
  const memoExpected = hmacMemo(trade.id);
  if (trade.expectedMemoHmac && trade.expectedMemoHmac !== memoExpected) {
    res.status(400).json({ error: "trade token mismatch" });
    return;
  }

  res.json({ ok: true, note: "Webhook received — reconcile with Roblox trade poll in production." });
});

export default router;
