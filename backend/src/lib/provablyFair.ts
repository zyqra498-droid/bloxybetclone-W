import crypto from "node:crypto";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function rollFromSeeds(serverSeed: string, clientSeed: string, nonce: string): number {
  const combined = sha256Hex(`${serverSeed}:${clientSeed}:${nonce}`);
  return parseInt(combined.slice(0, 8), 16);
}

/** Winner index 0 or 1 for coinflip (two players). */
export function coinflipWinnerIndex(serverSeed: string, clientSeed: string, nonce: string): 0 | 1 {
  const v = rollFromSeeds(serverSeed, clientSeed, nonce);
  return v % 2 === 0 ? 0 : 1;
}

/** Pick winning ticket in [0, totalTickets) */
export function jackpotWinningTicket(
  serverSeed: string,
  clientSeed: string,
  nonce: string,
  totalTickets: bigint
): bigint {
  if (totalTickets <= 0n) return 0n;
  const combined = sha256Hex(`${serverSeed}:${clientSeed}:${nonce}:jackpot`);
  const slice = combined.slice(0, 16);
  const n = BigInt(`0x${slice}`);
  return n % totalTickets;
}
