const ROBLOX_API = "https://apis.roblox.com";

/** Case-insensitive: bio text must contain the exact code (ignoring whitespace case). */
export function profileContainsVerificationCode(description: string, code: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  return norm(description).includes(norm(code));
}

/** Resolve display username → numeric Roblox user id (public API). */
export async function resolveRobloxUsernameToId(username: string): Promise<string | null> {
  const trimmed = username.trim();
  if (!trimmed) return null;
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usernames: [trimmed], excludeBannedUsers: false }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { data?: { id: number; name: string }[] };
  const row = j.data?.[0];
  if (!row?.id) return null;
  return String(row.id);
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

export async function exchangeRobloxCode(code: string): Promise<TokenResponse> {
  const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID;
  const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;
  const ROBLOX_CALLBACK_URL = process.env.ROBLOX_CALLBACK_URL;
  if (!ROBLOX_CLIENT_ID || !ROBLOX_CLIENT_SECRET || !ROBLOX_CALLBACK_URL) {
    throw new Error("OAuth is disabled");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: ROBLOX_CLIENT_ID,
    client_secret: ROBLOX_CLIENT_SECRET,
    redirect_uri: ROBLOX_CALLBACK_URL,
  });
  const res = await fetch(`${ROBLOX_API}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${t}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function refreshRobloxAccessToken(refreshToken: string): Promise<TokenResponse> {
  const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID;
  const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;
  if (!ROBLOX_CLIENT_ID || !ROBLOX_CLIENT_SECRET) {
    throw new Error("OAuth is disabled");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: ROBLOX_CLIENT_ID,
    client_secret: ROBLOX_CLIENT_SECRET,
  });
  const res = await fetch(`${ROBLOX_API}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${t}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export type RobloxUserInfo = {
  sub: string;
  name: string;
  nickname?: string;
  preferred_username?: string;
};

export async function fetchOpenIdUserInfo(accessToken: string): Promise<RobloxUserInfo> {
  const res = await fetch(`${ROBLOX_API}/oauth/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`userinfo failed: ${res.status} ${t}`);
  }
  return res.json() as Promise<RobloxUserInfo>;
}

export type RobloxPublicProfile = {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  isBanned: boolean;
  hasVerifiedBadge: boolean;
};

export async function fetchRobloxPublicProfile(userId: string): Promise<RobloxPublicProfile> {
  const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  if (!res.ok) throw new Error("user lookup failed");
  return res.json() as Promise<RobloxPublicProfile>;
}

/** Legacy helper — same as public profile `created` */
export async function fetchRobloxUserById(userId: string): Promise<{ created: string }> {
  const p = await fetchRobloxPublicProfile(userId);
  return { created: p.created };
}

export async function fetchAvatarHeadshotUrl(userId: string): Promise<string | null> {
  const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(userId)}&size=150x150&format=Png`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as { data?: { imageUrl?: string }[] };
  return j.data?.[0]?.imageUrl ?? null;
}

export async function fetchAvatarBustUrl(userId: string): Promise<string | null> {
  const url = `https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${encodeURIComponent(userId)}&size=150x150&format=Png`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as { data?: { imageUrl?: string }[] };
  return j.data?.[0]?.imageUrl ?? null;
}

/**
 * Attempts to read Robux using OAuth Bearer. Roblox may restrict this by app/scopes — returns null if unavailable.
 */
export async function fetchRobuxBalanceOAuth(accessToken: string, userId: string): Promise<number | null> {
  const res = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { robux?: number };
  return typeof j.robux === "number" ? j.robux : null;
}

export type CollectibleAsset = {
  userAssetId: number;
  assetId: number;
  name?: string;
};

export async function fetchUserCollectibles(userId: string): Promise<CollectibleAsset[]> {
  const out: CollectibleAsset[] = [];
  let cursor: string | undefined;
  try {
    do {
      // Documented public endpoint (Creator Hub). v2 …/users/…/assets/collectibles often returns 404.
      const u = new URL(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles`);
      u.searchParams.set("limit", "100");
      if (cursor) u.searchParams.set("cursor", cursor);
      const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.warn(`[roblox] collectibles user=${userId} status=${res.status} body=${t.slice(0, 300)}`);
        return out;
      }
      const j = (await res.json()) as { data?: CollectibleAsset[]; nextPageCursor?: string };
      out.push(...(j.data ?? []));
      cursor = j.nextPageCursor;
    } while (cursor);
  } catch (e) {
    console.warn(`[roblox] collectibles user=${userId}`, e);
    return out;
  }
  return out;
}

const CATALOG_SEARCH_LIMITS = new Set([10, 28, 30, 50, 60, 100, 120]);

export type CatalogSearchHit = {
  id: number;
  name: string;
  itemType: string;
  catalogUrl: string;
};

/**
 * Public catalog keyword search (no cookie). Names filled via items/details.
 * Limit must be one of Roblox’s allowed values.
 */
export async function searchCatalogAssets(keyword: string, limit = 30): Promise<CatalogSearchHit[]> {
  const q = keyword.trim();
  if (q.length < 2) return [];
  const lim = CATALOG_SEARCH_LIMITS.has(limit) ? limit : 30;
  const u = new URL("https://catalog.roblox.com/v1/search/items");
  u.searchParams.set("category", "All");
  u.searchParams.set("keyword", q);
  u.searchParams.set("limit", String(lim));
  u.searchParams.set("sortOrder", "Relevance");
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.warn(`[roblox] catalog search ${res.status}: ${t.slice(0, 200)}`);
    return [];
  }
  const j = (await res.json()) as { data?: { id: number; itemType: string }[] };
  const pairs = j.data ?? [];
  const ids = pairs.map((p) => p.id).filter((id) => typeof id === "number");
  if (ids.length === 0) return [];
  const details = await fetchAssetDetails(ids);
  return pairs.map((p) => ({
    id: p.id,
    name: details.get(p.id)?.name ?? `Asset ${p.id}`,
    itemType: p.itemType ?? "Asset",
    catalogUrl: `https://www.roblox.com/catalog/${p.id}/`,
  }));
}

export async function fetchAssetDetails(assetIds: number[]): Promise<Map<number, { name: string }>> {
  const map = new Map<number, { name: string }>();
  const chunk = 50;
  for (let i = 0; i < assetIds.length; i += chunk) {
    const slice = assetIds.slice(i, i + chunk);
    const res = await fetch("https://catalog.roblox.com/v1/catalog/items/details", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: slice.map((id) => ({ itemType: "Asset", id })) }),
    });
    if (!res.ok) continue;
    const j = (await res.json()) as { data?: { id: number; name: string }[] };
    for (const row of j.data ?? []) {
      map.set(row.id, { name: row.name });
    }
  }
  return map;
}

export async function fetchAssetThumbnailUrl(assetId: string): Promise<string | null> {
  if (!/^\d+$/.test(assetId.trim())) return null;
  const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${encodeURIComponent(assetId)}&returnPolicy=PlaceHolder&size=150x150&format=Png`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as { data?: { imageUrl?: string }[] };
  return j.data?.[0]?.imageUrl ?? null;
}
