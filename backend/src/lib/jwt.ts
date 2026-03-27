import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { getConfig } from "../config.js";

export type AccessPayload = { sub: string; sid: string; typ: "access" };

export function signAccessToken(userId: string, sessionId: string): string {
  const { JWT_SECRET, JWT_ACCESS_TTL_SEC } = getConfig();
  return jwt.sign({ sub: userId, sid: sessionId, typ: "access" }, JWT_SECRET, {
    expiresIn: JWT_ACCESS_TTL_SEC,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const { JWT_SECRET } = getConfig();
  const p = jwt.verify(token, JWT_SECRET) as AccessPayload;
  if (p.typ !== "access") throw new Error("Invalid token type");
  return p;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}
