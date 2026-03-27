/**
 * Roblox Trades API (session cookie). Comply with Roblox ToS and your use case.
 * @see https://create.roblox.com/docs/cloud/legacy/trades/v1
 */

const AUTH = "https://auth.roblox.com";
const TRADES = "https://trades.roblox.com";
const USERS = "https://users.roblox.com";

/** Normalize stored cookie to a full Cookie header value. */
export function normalizeRobloxCookieHeader(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.includes("ROBLOSECURITY") && t.includes("=")) return t;
  return `.ROBLOSECURITY=${t}`;
}

/** First unauthenticated POST returns 403 + x-csrf-token (standard Roblox pattern). */
export async function fetchRobloxCsrfToken(cookieHeader: string): Promise<string> {
  const res = await fetch(`${AUTH}/v2/logout`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/json", Accept: "application/json" },
    body: "{}",
  });
  const token = res.headers.get("x-csrf-token");
  if (!token) {
    const t = await res.text().catch(() => "");
    throw new Error(`Roblox CSRF: no x-csrf-token (status ${res.status}) ${t.slice(0, 120)}`);
  }
  return token;
}

export async function getAuthenticatedRobloxUserId(cookieHeader: string): Promise<number | null> {
  const res = await fetch(`${USERS}/v1/users/authenticated`, {
    headers: { Cookie: cookieHeader, Accept: "application/json" },
    redirect: "manual",
  });
  if (!res.ok) return null;
  const j = (await res.json().catch(() => null)) as { id?: number } | null;
  return typeof j?.id === "number" ? j.id : null;
}

type InboundRow = { id?: string | number };

export async function listInboundTradeIds(cookieHeader: string, csrf: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const u = new URL(`${TRADES}/v1/trades/Inbound`);
    u.searchParams.set("sortOrder", "Asc");
    u.searchParams.set("limit", "25");
    if (cursor) u.searchParams.set("cursor", cursor);
    const res = await fetch(u.toString(), {
      headers: { Cookie: cookieHeader, Accept: "application/json", "X-CSRF-TOKEN": csrf },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn(`[roblox-trades] list Inbound ${res.status}: ${t.slice(0, 200)}`);
      break;
    }
    const j = (await res.json()) as { data?: InboundRow[]; nextPageCursor?: string };
    for (const row of j.data ?? []) {
      if (row.id != null) ids.push(String(row.id));
    }
    cursor = j.nextPageCursor ?? undefined;
    if (!cursor) break;
  }
  return ids;
}

export type RobloxTradeDetail = Record<string, unknown>;

export async function getTradeDetail(cookieHeader: string, csrf: string, tradeId: string): Promise<RobloxTradeDetail | null> {
  let res = await fetch(`${TRADES}/v2/trades/${encodeURIComponent(tradeId)}`, {
    headers: { Cookie: cookieHeader, Accept: "application/json", "X-CSRF-TOKEN": csrf },
  });
  if (!res.ok) {
    res = await fetch(`${TRADES}/v1/trades/${encodeURIComponent(tradeId)}`, {
      headers: { Cookie: cookieHeader, Accept: "application/json", "X-CSRF-TOKEN": csrf },
    });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.warn(`[roblox-trades] get trade ${tradeId} ${res.status}: ${t.slice(0, 200)}`);
    return null;
  }
  return (await res.json()) as RobloxTradeDetail;
}

function pickString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

/** Roblox trade status e.g. Completed, Incomplete (v1/v2 shapes differ). */
export function readTradeStatus(detail: RobloxTradeDetail | null): string | null {
  if (!detail) return null;
  const direct = pickString(detail, ["status", "tradeStatus", "state"]);
  if (direct) return direct;
  const trade = detail.trade;
  if (trade && typeof trade === "object") {
    const nested = pickString(trade, ["status", "tradeStatus", "state"]);
    if (nested) return nested;
  }
  const data = detail.data;
  if (data && typeof data === "object") {
    const nested = pickString(data, ["status", "tradeStatus", "state"]);
    if (nested) return nested;
  }
  return null;
}

type OfferLike = {
  userId?: number;
  user?: { id?: number; name?: string };
  userAssets?: Array<{ assetId?: number; id?: number; assetIdString?: string; name?: string }>;
  robloxItems?: Array<{ assetId?: number; id?: number; assetIdString?: string }>;
  items?: Array<{ assetId?: number; assetIdString?: string }>;
};

function collectCatalogIdsFromAssets(ua: OfferLike["userAssets"]): string[] {
  const assetIds: string[] = [];
  if (!Array.isArray(ua)) return assetIds;
  for (const row of ua) {
    if (!row) continue;
    if (row.assetId != null) assetIds.push(String(row.assetId));
    else if (row.assetIdString != null) assetIds.push(String(row.assetIdString));
  }
  return assetIds;
}

/** Catalog asset IDs the partner (non-bot) is offering to the bot — for deposit matching. */
export function extractPartnerOfferCatalogAssetIds(
  detail: RobloxTradeDetail,
  botUserId: number,
): { partnerName: string; assetIds: string[]; partnerRobloxUserId: number | null } | null {
  const offers = detail.offers as OfferLike[] | undefined;
  if (!Array.isArray(offers)) return null;
  const partnerOffer = offers.find((o) => {
    const uid = o.userId ?? o.user?.id;
    return uid != null && uid !== botUserId;
  });
  if (!partnerOffer) return null;
  const partnerName = partnerOffer.user?.name ?? "";
  const uidRaw = partnerOffer.user?.id ?? partnerOffer.userId;
  const partnerRobloxUserId = typeof uidRaw === "number" ? uidRaw : null;
  let assetIds = collectCatalogIdsFromAssets(partnerOffer.userAssets);
  if (assetIds.length === 0 && Array.isArray(partnerOffer.robloxItems)) {
    for (const it of partnerOffer.robloxItems) {
      if (it?.assetId != null) assetIds.push(String(it.assetId));
      else if (it?.assetIdString != null) assetIds.push(String(it.assetIdString));
    }
  }
  if (assetIds.length === 0 && Array.isArray(partnerOffer.items)) {
    for (const it of partnerOffer.items) {
      if (it?.assetId != null) assetIds.push(String(it.assetId));
      else if (it?.assetIdString != null) assetIds.push(String(it.assetIdString));
    }
  }
  return { partnerName, assetIds, partnerRobloxUserId };
}

/**
 * Accept an inbound trade as the authenticated (bot) user.
 * @see POST /v1/trades/{tradeId}/accept
 */
export async function acceptInboundTrade(
  cookieHeader: string,
  csrf: string,
  tradeId: string,
): Promise<{ ok: true } | { ok: false; error: string; retryCsrf?: boolean }> {
  const res = await fetch(`${TRADES}/v1/trades/${encodeURIComponent(tradeId)}/accept`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": csrf,
    },
    body: "{}",
  });
  const raw = await res.text().catch(() => "");
  if (res.ok) return { ok: true };

  const lower = raw.toLowerCase();
  if (
    res.status === 403 &&
    res.headers.get("x-csrf-token") &&
    (lower.includes("csrf") || lower.includes("token") || lower.includes("verification"))
  ) {
    return { ok: false, error: "csrf_token_invalid", retryCsrf: true };
  }
  if (
    (res.status === 400 || res.status === 409) &&
    (lower.includes("already") || lower.includes("not pending") || lower.includes("processed") || lower.includes("completed"))
  ) {
    return { ok: true };
  }

  let msg = `accept_${res.status}`;
  try {
    const j = JSON.parse(raw) as { errors?: { message?: string }[] };
    if (j.errors?.[0]?.message) msg = j.errors[0].message;
  } catch {
    if (raw.length > 0 && raw.length < 400) msg = raw;
  }
  return { ok: false, error: msg };
}

export async function sendTradeBotGivesUserReceives(opts: {
  cookieHeader: string;
  csrf: string;
  botUserId: number;
  targetUserId: number;
  /** Bot-owned user asset instance IDs to send. */
  botUserAssetIds: number[];
}): Promise<{ ok: true; tradeId: string } | { ok: false; error: string }> {
  const { cookieHeader, csrf, botUserId, targetUserId, botUserAssetIds } = opts;
  const body = {
    offers: [
      { userId: targetUserId, userAssetIds: [] as number[], robux: 0 },
      { userId: botUserId, userAssetIds: botUserAssetIds, robux: 0 },
    ],
  };
  const postSend = (path: string) =>
    fetch(`${TRADES}${path}`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrf,
      },
      body: JSON.stringify(body),
    });

  let res = await postSend("/v2/trades/send");
  let raw = await res.text().catch(() => "");
  if (!res.ok) {
    const res1 = await postSend("/v1/trades/send");
    const raw1 = await res1.text().catch(() => "");
    res = res1;
    raw = raw1;
  }
  if (!res.ok) {
    console.warn(`[roblox-trades] send ${res.status}: ${raw.slice(0, 400)}`);
    let msg = `send_failed_${res.status}`;
    try {
      const j = JSON.parse(raw) as { errors?: { message?: string }[] };
      if (j.errors?.[0]?.message) msg = j.errors[0].message;
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg };
  }
  try {
    const j = JSON.parse(raw) as { id?: string | number };
    if (j.id != null) return { ok: true, tradeId: String(j.id) };
  } catch {
    /* ignore */
  }
  return { ok: false, error: "send_parse_no_id" };
}
