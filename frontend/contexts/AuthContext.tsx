"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Me } from "@/lib/types";
import { apiFetch, getApiBase } from "@/lib/api";

const AUTH_CHANNEL = "auth-channel";

type AuthContextValue = {
  user: Me | null;
  setUser: (u: Me | null) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** CSRF cookie is available (health resolved); safe for bio/start and other POSTs */
  isCsrfReady: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function broadcastAuthLogin(): void {
  if (typeof window === "undefined") return;
  try {
    new BroadcastChannel(AUTH_CHANNEL).postMessage({ type: "login" });
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCsrfReady, setIsCsrfReady] = useState(false);

  const refreshMe = useCallback(async () => {
    const res = await apiFetch("/api/auth/me");
    if (res.ok) {
      const data = (await res.json()) as Me;
      setUser(data);
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetch(`${getApiBase()}/api/health`, { credentials: "include" })
      .then(() => setIsCsrfReady(true))
      .catch(() => setIsCsrfReady(true));
  }, []);

  useEffect(() => {
    if (!isCsrfReady) return;
    setIsLoading(true);
    void refreshMe().finally(() => setIsLoading(false));
  }, [isCsrfReady, refreshMe]);

  useEffect(() => {
    if (!isCsrfReady) return;
    const bc = new BroadcastChannel(AUTH_CHANNEL);
    bc.onmessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === "logout") {
        setUser(null);
      }
      if (e.data?.type === "login") {
        void refreshMe();
      }
    };
    return () => bc.close();
  }, [isCsrfReady, refreshMe]);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    setUser(null);
    try {
      new BroadcastChannel(AUTH_CHANNEL).postMessage({ type: "logout" });
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      setUser,
      isLoading,
      isLoggedIn: !!user,
      logout,
      refreshMe,
      isCsrfReady,
    }),
    [user, isLoading, logout, refreshMe, isCsrfReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
