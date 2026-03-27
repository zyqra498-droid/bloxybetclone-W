"use client";

import { useAuth } from "@/contexts/AuthContext";
import { SidebarLayoutProvider, useSidebarLayout } from "@/contexts/SidebarLayoutContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useMediaMd } from "@/hooks/useMediaMd";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Navbar } from "@/components/layout/Navbar";
import { RightChatRail, RIGHT_CHAT_RAIL_WIDTH_PX } from "@/components/layout/RightChatRail";
import { Sidebar } from "@/components/layout/Sidebar";
import { useMediaXl } from "@/hooks/useMediaXl";
import { motion } from "framer-motion";

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const { user: me, isLoading } = useAuth();
  const { sidebarWidthPx } = useSidebarLayout();
  const isMd = useMediaMd();
  const isXl = useMediaXl();
  const mainPadLeft = isMd ? sidebarWidthPx : 0;
  const mainPadRight = isXl ? RIGHT_CHAT_RAIL_WIDTH_PX() : 0;

  return (
    <div className="relative min-h-[100dvh] bg-bg-primary">
      <div className="shell-mesh opacity-80 animate-aurora" aria-hidden />
      <div className="shell-grid" aria-hidden />
      <Sidebar me={me} isLoading={isLoading} />
      <Navbar />
      <RightChatRail />
      <motion.main
        className="relative z-[1] min-h-[100dvh] overflow-x-hidden pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] transition-[padding] duration-300 ease-in-out md:pb-6"
        style={{ paddingLeft: mainPadLeft, paddingRight: mainPadRight }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="mx-auto max-w-7xl px-4 py-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </motion.main>
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
