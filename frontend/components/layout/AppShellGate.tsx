"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

const NO_SHELL_PREFIXES = ["/login", "/verify"];

function pathSkipsShell(pathname: string | null): boolean {
  if (!pathname) return false;
  return NO_SHELL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AppShellGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathSkipsShell(pathname)) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
