"use client";

import type { CSSProperties } from "react";
import hotToast, { Toaster } from "react-hot-toast";

const baseStyle: CSSProperties = {
  background: "#1a1a24",
  color: "#f0f0ff",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "10px",
};

export function AppToaster() {
  return <Toaster position="bottom-right" toastOptions={{ duration: 4000, style: baseStyle }} />;
}

/** Design-system toast helpers (does not shadow `react-hot-toast` default export name in call sites). */
export const notify = {
  win: (message: string) =>
    hotToast.success(message, {
      icon: "🏆",
      style: { ...baseStyle, borderLeft: "3px solid #3dffa0" },
    }),
  loss: (message: string) =>
    hotToast(message, {
      icon: "💸",
      style: { ...baseStyle, borderLeft: "3px solid #55556a", opacity: 0.95 },
    }),
  info: (message: string) =>
    hotToast(message, {
      icon: "ℹ️",
      style: { ...baseStyle, borderLeft: "3px solid #4f8ef7" },
    }),
  deposit: (message: string) =>
    hotToast(message, {
      icon: "📦",
      style: { ...baseStyle, borderLeft: "3px solid #7c5cfc" },
    }),
  error: (message: string) =>
    hotToast.error(message, {
      duration: 6000,
      style: { ...baseStyle, borderLeft: "3px solid #ff4d4d" },
    }),
};
