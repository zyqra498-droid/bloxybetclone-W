import crypto from "node:crypto";
import { getConfig } from "../config.js";

const IV_LEN = 16;

function getKey(): Buffer {
  return crypto.createHash("sha256").update(getConfig().ENCRYPTION_KEY).digest();
}

export function encryptString(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptString(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function hmacMemo(tradeId: string): string {
  return crypto.createHmac("sha256", getConfig().TRADE_HMAC_SECRET).update(tradeId).digest("hex").slice(0, 32);
}
