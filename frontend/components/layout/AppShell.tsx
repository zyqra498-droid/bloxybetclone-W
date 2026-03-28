"use client";

import { useAuth } from "@/contexts/AuthContext";
import { SidebarLayoutProvider, useSidebarLayout } from "@/contexts/SidebarLayoutContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useMediaMd } from "@/hooks/useMediaMd";
import { useMediaXl } from "@/hooks/useMediaXl";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Navbar } from "@/components/layout/Navbar";
import { RightChatRail, RIGHT_CHAT_RAIL_WIDTH_PX } from "@/components/layout/RightChatRail";
import { Sidebar } from "@/components/layout/Sidebar";
import { motion } from "framer-motion";

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const { user: me, isLoading } = useAuth();
  const { sidebarWidthPx } = useSidebarLayout();
  const isMd = useMediaMd();
  const isXl = useMediaXl();

  const mainPadLeft  = isMd  ? sidebarWidthPx           : 0;
  const mainPadRight = isXl  ? RIGHT_CHAT_RAIL_WIDTH_PX() : 0;

  return (
    /* Full-height dark base */
    <div className="relative min-h-[100dvh] bg-bg-base">

      {/* Subtle ambient background glow — kept very faint */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 60% 35% at 12% -5%, rgba(125,211,252,0.04), transparent 50%)",
            "radial-gradient(ellipse 45% 25% at 90% 8%, rgba(0,200,150,0.03), transparent 45%)",
          ].join(", "),
        }}
      />

      {/* ── Sidebar (fixed left, desktop only) ── */}
      <Sidebar me={me} isLoading={isLoading} />

      {/* ── Top navbar (fixed, spans sidebar → right edge) ── */}
      <Navbar />

      {/* ── Right chat rail (fixed right, xl+ only) ── */}
      <RightChatRail />

      {/* ── Main content area ── */}
      <motion.main
        className="relative z-[1] min-h-[100dvh] overflow-x-hidden"
        style={{
          paddingLeft:   mainPadLeft,
          paddingRight:  mainPadRight,
          paddingTop:    56, /* navbar height */
          paddingBottom: isMd ? 24 : 72, /* mobile: room for tab bar */
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/*
          No max-width constraint here — pages control their own width.
          This matches BloxyBet where the content fills the column.
        */}
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </motion.main>

      {/* ── Mobile bottom tab bar ── */}
      <MobileTabBar />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarLayoutProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </SidebarLayoutProvider>
  );
}
