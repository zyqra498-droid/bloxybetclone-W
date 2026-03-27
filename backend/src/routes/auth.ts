import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { getConfig } from "../config.js";
import {
  fetchAvatarBustUrl,
  fetchAvatarHeadshotUrl,
  fetchRobloxPublicProfile,
  fetchRobloxUserById,
  profileContainsVerificationCode,
  resolveRobloxUsernameToId,
} from "../services/robloxApi.js";
import { prisma } from "../lib/prisma.js";
import { hashToken, randomRefreshToken, signAccessToken } from "../lib/jwt.js";
import { authLimiter } from "../middleware/rateLimits.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { writeAudit } from "../services/auditLog.js";

const router = Router();

function authCookieOpts(maxAgeMs: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? ("strict" as const) : ("lax" as const),
    secure: isProd,
    path: "/",
    maxAge: maxAgeMs,
  };
}

function clearAuthCookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    path: "/",
    sameSite: isProd ? ("strict" as const) : ("lax" as const),
    secure: isProd,
  };
}

function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string") return xf.split(",")[0]?.trim() || "unknown";
  return req.ip || "unknown";
}

function generateBioCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "0123456789";
  let a = "";
  for (let i = 0; i < 3; i++) a += letters[crypto.randomInt(letters.length)];
  let b = "";
  for (let i = 0; i < 4; i++) b += nums[crypto.randomInt(nums.length)];
  return `${a}-${b}`;
}

const startSchema = z.object({});

router.post("/bio/start", authLimiter, requireCsrf, async (req, res) => {
  const parsed = startSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid" });
    return;
  }
  const { BIO_CHALLENGE_TTL_SEC } = getConfig();
  const ip = clientIp(req);
  const expiresAt = new Date(Date.now() + BIO_CHALLENGE_TTL_SEC * 1000);

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateBioCode();
    try {
      const row = await prisma.bioChallenge.create({
        data: { code, expiresAt, ip },
      });
      res.json({
        challengeId: row.id,
        code: row.code,
        expiresAt: row.expiresAt.toISOString(),
        ttlSec: BIO_CHALLENGE_TTL_SEC,
      });
      return;
    } catch {
      /* unique collision on code */
    }
  }
  res.status(503).json({ error: "Could not allocate code" });
});

const verifySchema = z.object({
  challengeId: z.string().min(1),
  username: z.string().min(3).max(32),
});

router.post("/bio/verify", authLimiter, requireCsrf, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const challenge = await prisma.bioChallenge.findUnique({
    where: { id: parsed.data.challengeId },
  });
  if (!challenge || challenge.consumedAt) {
    res.status(400).json({ error: "Invalid or used challenge" });
    return;
  }
  if (challenge.expiresAt < new Date()) {
    res.status(400).json({ error: "Challenge expired — start again" });
    return;
  }

  const robloxId = await resolveRobloxUsernameToId(parsed.data.username);
  if (!robloxId) {
    res.status(400).json({ error: "Roblox username not found" });
    return;
  }

  let profile;
  try {
    profile = await fetchRobloxPublicProfile(robloxId);
  } catch {
    res.status(400).json({ error: "Could not load Roblox profile" });
    return;
  }

  if (profile.isBanned) {
    res.status(403).json({ error: "This Roblox account is banned" });
    return;
  }

  if (!profileContainsVerificationCode(profile.description ?? "", challenge.code)) {
    res.status(400).json({
      error: "Verification code not found in your profile About / bio. Paste the code, save, wait a minute, then try again.",
    });
    return;
  }

  const ip = clientIp(req);
  const { JWT_REFRESH_TTL_SEC } = getConfig();

  const existing = await prisma.user.findUnique({ where: { robloxId } });
  let suspicious = existing?.suspiciousScore ?? 0;
  if (existing?.lastLoginIp && existing.lastLoginIp !== ip) suspicious += 1;

  const [created, avatarUrl, bustUrl] = await Promise.all([
    fetchRobloxUserById(robloxId).catch(() => null),
    fetchAvatarHeadshotUrl(robloxId),
    fetchAvatarBustUrl(robloxId),
  ]);

  const user = await prisma.user.upsert({
    where: { robloxId },
    create: {
      robloxId,
      username: profile.name,
      avatarUrl: avatarUrl ?? bustUrl ?? undefined,
      accountCreatedAt: created ? new Date(created.created) : new Date(profile.created),
      ipAddress: ip,
      lastLoginIp: ip,
      suspiciousScore: suspicious,
    },
    update: {
      username: profile.name,
      avatarUrl: avatarUrl ?? bustUrl ?? undefined,
      accountCreatedAt: created ? new Date(created.created) : new Date(profile.created),
      lastLoginIp: ip,
      suspiciousScore: suspicious,
    },
  });

  await prisma.loginEvent.create({
    data: { userId: user.id, ip, success: true },
  });

  if (suspicious >= 3) {
    await prisma.flaggedAccount.create({
      data: {
        userId: user.id,
        reason: "multiple_ip_logins",
        metadata: { ip, previous: existing?.lastLoginIp },
      },
    });
  }

  await prisma.bioChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  const refresh = randomRefreshToken();
  const refreshHash = hashToken(refresh);
  const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_SEC * 1000);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: refreshHash,
      ip,
      expiresAt,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "bio_login_success",
    ip,
    metadata: { robloxId: user.robloxId, username: user.username },
  });

  const access = signAccessToken(user.id, session.id);

  res.cookie("access_token", access, authCookieOpts(getConfig().JWT_ACCESS_TTL_SEC * 1000));
  res.cookie("refresh_token", refresh, authCookieOpts(JWT_REFRESH_TTL_SEC * 1000));

  res.json({
    ok: true,
    user: {
      id: user.id,
      robloxId: user.robloxId,
      username: user.username,
    },
  });
});

router.post("/logout", requireCsrf, async (req, res) => {
  const refresh = req.cookies?.refresh_token as string | undefined;
  if (refresh) {
    const h = hashToken(refresh);
    await prisma.session.deleteMany({ where: { refreshTokenHash: h } });
  }
  const cco = clearAuthCookieOpts();
  res.clearCookie("access_token", cco);
  res.clearCookie("refresh_token", cco);
  res.json({ ok: true });
});

router.post("/refresh", requireCsrf, authLimiter, async (req, res) => {
  const refresh = req.cookies?.refresh_token as string | undefined;
  if (!refresh) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }
  const h = hashToken(refresh);
  const session = await prisma.session.findFirst({ where: { refreshTokenHash: h } });
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: "Invalid refresh" });
    return;
  }

  const newRefresh = randomRefreshToken();
  const newHash = hashToken(newRefresh);
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: newHash, expiresAt: new Date(Date.now() + getConfig().JWT_REFRESH_TTL_SEC * 1000) },
  });

  const access = signAccessToken(session.userId, session.id);
  const cfg = getConfig();
  res.cookie("access_token", access, authCookieOpts(cfg.JWT_ACCESS_TTL_SEC * 1000));
  res.cookie("refresh_token", newRefresh, authCookieOpts(cfg.JWT_REFRESH_TTL_SEC * 1000));
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: { linkedBot: { select: { id: true, robloxUsername: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const publicProfile = await fetchRobloxPublicProfile(user.robloxId).catch(() => null);

  const accountAgeDays = publicProfile
    ? Math.floor((Date.now() - new Date(publicProfile.created).getTime()) / (86400 * 1000))
    : user.accountCreatedAt
      ? Math.floor((Date.now() - user.accountCreatedAt.getTime()) / (86400 * 1000))
      : null;

  const cfg = getConfig();
  res.json({
    id: user.id,
    robloxId: user.robloxId,
    username: user.username,
    displayName: publicProfile?.displayName ?? user.username,
    description: publicProfile?.description ?? "",
    avatarUrl: user.avatarUrl,
    profileUrl: `https://www.roblox.com/users/${user.robloxId}/profile`,
    accountCreatedAt: publicProfile?.created ?? user.accountCreatedAt?.toISOString() ?? null,
    accountAgeDays,
    isBannedOnRoblox: publicProfile?.isBanned ?? false,
    hasVerifiedBadge: publicProfile?.hasVerifiedBadge ?? false,
    robux: null,
    robuxLastSynced: false,
    balanceCoins: Number(user.balanceCoins),
    lockedCoins: Number(user.lockedCoins),
    isAdmin: user.isAdmin,
    adminTotpEnabled: user.adminTotpEnabled,
    siteCreatedAt: user.createdAt.toISOString(),
    lastLoginIp: user.lastLoginIp,
    suspiciousScore: user.suspiciousScore,
    authMethod: "bio",
    linkedBot: user.linkedBot
      ? { id: user.linkedBot.id, robloxUsername: user.linkedBot.robloxUsername }
      : null,
    mockRobloxTrades: cfg.MOCK_ROBLOX_TRADES,
  });
});

export default router;
