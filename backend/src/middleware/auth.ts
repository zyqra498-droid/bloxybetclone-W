import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/jwt.js";

export type AuthedRequest = Request & { userId?: string; sessionId?: string };

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.banned) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.userId = payload.sub;
    req.sessionId = payload.sid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
}

export async function optionalAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && !user.banned) {
      req.userId = payload.sub;
      req.sessionId = payload.sid;
    }
  } catch {
    /* ignore */
  }
  next();
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.banned) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!user.isAdmin) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    if (user.adminTotpEnabled) {
      const code = req.headers["x-admin-totp"] as string | undefined;
      if (!code) {
        res.status(401).json({ error: "Admin TOTP required" });
        return;
      }
      const { authenticator } = await import("otplib");
      const ok = user.adminTotpSecret && authenticator.verify({ token: code, secret: user.adminTotpSecret });
      if (!ok) {
        res.status(401).json({ error: "Invalid TOTP" });
        return;
      }
    }
    req.userId = payload.sub;
    req.sessionId = payload.sid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
}
