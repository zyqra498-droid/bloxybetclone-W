"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppShellGate } from "@/components/layout/AppShellGate";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ThemeProvider>
          <AppShellGate>{children}</AppShellGate>
        </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
