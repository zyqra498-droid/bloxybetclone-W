"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// Import AppShell with ssr:false so socket.io-client and framer-motion
// are never evaluated during server-side prerendering
const AppShell = dynamic(
  () => import("@/components/layout/AppShell").then((m) => m.AppShell),
  { ssr: false }
);

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
