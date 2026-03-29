/**
 * API origin for fetch. In the browser, if `NEXT_PUBLIC_API_URL` is unset, uses same-origin
 * (`""`) so requests go to `/api/*` and Next.js rewrites proxy to the backend (good for Render).
 * Server-side uses `INTERNAL_API_URL` or localhost:4000.
 */
export function getApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return "";
  return process.env.INTERNAL_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:4000";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const csrf = readCookie("csrf_token");
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      if (csrf) headers.set("X-CSRF-Token", csrf);
      const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers,
        body: "{}",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function shouldRedirectOnAuthFailure(path: string): boolean {
  if (path.includes("/api/auth/me")) return false;
  if (path.includes("/api/health")) return false;
  return true;
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const csrf = readCookie("csrf_token");
  if (csrf && init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method)) {
    headers.set("X-CSRF-Token", csrf);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

/** Attach `X-Admin-TOTP` for mutating `/api/admin/*` requests when 2FA is enabled. */
export function withAdminTotp(init: RequestInit, totpCode: string | null | undefined): RequestInit {
  const code = totpCode?.trim();
  if (!code) return init;
  const headers = new Headers(init.headers);
  headers.set("X-Admin-TOTP", code);
  return { ...init, headers };
}

/**
 * Fetch API routes with credentials. On 401, calls POST /api/auth/refresh once and retries the request.
 * Redirects to /login only if refresh fails (except for session probe endpoints like /api/auth/me).
 */
export async function apiFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const headers = buildHeaders(init);
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    return new Response(JSON.stringify({ error: `Network error — API unreachable at ${getApiBase()}. Is the backend running?` }), {
      status: 503,
      statusText: "Network Error",
      headers: { "Content-Type": "application/json" },
    });
  }

  if (res.status !== 401 || retried) {
    return res;
  }

  if (path.includes("/api/auth/refresh")) {
    return res;
  }

  const refreshed = await tryRefresh();
  if (refreshed) {
    return apiFetch(path, init, true);
  }

  if (shouldRedirectOnAuthFailure(path) && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  return res;
}
