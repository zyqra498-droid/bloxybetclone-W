"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/* NOTE: Do not use `next/dynamic(..., { ssr: false })` for AppShell — on Next 15
   production builds it can trip the Pages `/_error` prerender and throw
   "<Html> should not be imported outside of pages/_document". Static import is safe
   because AppShell is a client component and AppShellGate skips rendering it until mounted. */

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
