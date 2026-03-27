import { Router } from "express";
import { z } from "zod";
import { sha256Hex } from "../lib/provablyFair.js";

const router = Router();

const bodySchema = z.object({
  serverSeed: z.string(),
  clientSeed: z.string(),
  nonce: z.string(),
});

router.post("/coinflip", (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { serverSeed, clientSeed, nonce } = parsed.data;
  const serverSeedHash = sha256Hex(serverSeed);
  const combined = sha256Hex(`${serverSeed}:${clientSeed}:${nonce}`);
  const roll = parseInt(combined.slice(0, 8), 16);
  const side = roll % 2;
  res.json({ serverSeedHash, combinedHash: combined, roll, winnerSide: side });
});

router.post("/jackpot", (req, res) => {
  const parsed = bodySchema
    .extend({ totalTickets: z.string() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { serverSeed, clientSeed, nonce, totalTickets } = parsed.data;
  const combined = sha256Hex(`${serverSeed}:${clientSeed}:${nonce}:jackpot`);
  const slice = combined.slice(0, 16);
  const n = BigInt(`0x${slice}`);
  const tt = BigInt(totalTickets);
  const ticket = tt > 0n ? n % tt : 0n;
  res.json({ combinedHash: combined, winningTicket: ticket.toString() });
});

export default router;
