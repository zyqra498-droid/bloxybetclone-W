"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "sidebar_collapsed";

type SidebarLayoutValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;
  sidebarWidthPx: 64 | 240;
};

const SidebarLayoutContext = createContext<SidebarLayoutValue | null>(null);

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "0") setCollapsedState(false);
      else if (raw === "1") setCollapsedState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<SidebarLayoutValue>(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      sidebarWidthPx: collapsed ? 64 : 240,
    }),
    [collapsed, setCollapsed, toggleCollapsed],
  );

  return <SidebarLayoutContext.Provider value={value}>{children}</SidebarLayoutContext.Provider>;
}

export function useSidebarLayout(): SidebarLayoutValue {
  const ctx = useContext(SidebarLayoutContext);
  if (!ctx) {
    throw new Error("useSidebarLayout must be used within SidebarLayoutProvider");
  }
  return ctx;
}
