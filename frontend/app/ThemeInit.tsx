"use client";

import { useLayoutEffect } from "react";

const STORAGE_KEY = "robloxbet-theme";

/** Applies saved theme before paint (no inline <script> — avoids Next/React key warnings on <body>). */
export function ThemeInit() {
  useLayoutEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t === "light" || t === "dark") {
        document.documentElement.setAttribute("data-theme", t);
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
