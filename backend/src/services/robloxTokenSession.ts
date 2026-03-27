import { prisma } from "../lib/prisma.js";
import { decryptString, encryptString } from "../lib/cryptoUtil.js";
import { refreshRobloxAccessToken } from "./robloxApi.js";

/**
 * Returns a usable Roblox OAuth access token for this site session, refreshing when possible.
 */
export async function ensureRobloxAccessToken(sessionId: string): Promise<string | null> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session?.robloxAccessTokenEncrypted) return null;

  const exp = session.robloxAccessExpiresAt;
  const freshEnough = exp && exp.getTime() > Date.now() + 60_000;
  if (freshEnough) {
    return decryptString(session.robloxAccessTokenEncrypted);
  }

  if (session.robloxRefreshTokenEncrypted) {
    try {
      const rt = decryptString(session.robloxRefreshTokenEncrypted);
      const next = await refreshRobloxAccessToken(rt);
      const enc = encryptString(next.access_token);
      const rtEnc = next.refresh_token ? encryptString(next.refresh_token) : session.robloxRefreshTokenEncrypted;
      const expiresAt = next.expires_in ? new Date(Date.now() + next.expires_in * 1000) : null;
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          robloxAccessTokenEncrypted: enc,
          robloxRefreshTokenEncrypted: rtEnc,
          robloxAccessExpiresAt: expiresAt,
        },
      });
      return next.access_token;
    } catch {
      /* fall through */
    }
  }

  try {
    return decryptString(session.robloxAccessTokenEncrypted);
  } catch {
    return null;
  }
}
