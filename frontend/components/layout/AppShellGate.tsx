"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

const NO_SHELL_PREFIXES = ["/login", "/verify"];

function pathSkipsShell(pathname: string | null): boolean {
  if (!pathname) return false;
  return NO_SHELL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AppShellGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (pathSkipsShell(pathname)) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
