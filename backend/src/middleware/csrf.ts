import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../config.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

function signToken(token: string): string {
  const secret = getConfig().CSRF_SECRET;
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function csrfCookieMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies?.csrf_token) {
    const raw = crypto.randomBytes(32).toString("hex");
    const sig = signToken(raw);
    const value = `${raw}.${sig}`;
    res.cookie("csrf_token", value, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7 * 1000,
    });
  }
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE.has(req.method)) {
    next();
    return;
  }
  const cookie = req.cookies?.csrf_token as string | undefined;
  const header = (req.headers["x-csrf-token"] as string | undefined) ?? req.headers["csrf-token"] as string | undefined;
  if (!cookie || !header || cookie !== header) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }
  const [raw, sig] = cookie.split(".");
  if (!raw || !sig || signToken(raw) !== sig) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }
  next();
}
