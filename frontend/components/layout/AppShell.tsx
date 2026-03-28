"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { useAuth } from "@/contexts/AuthContext";
import {
  SidebarLayoutProvider,
  useSidebarLayout,
} from "@/contexts/SidebarLayoutContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useMediaMd } from "@/hooks/useMediaMd";
import { useMediaXl } from "@/hooks/useMediaXl";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Navbar } from "@/components/layout/Navbar";
import {
  RightChatRail,
  RIGHT_CHAT_RAIL_WIDTH_PX,
} from "@/components/layout/RightChatRail";
import { Sidebar } from "@/components/layout/Sidebar";

const NAVBAR_HEIGHT_PX = 56;
const MOBILE_TAB_BAR_SPACE_PX = 72;
const DESKTOP_BOTTOM_SPACE_PX = 24;

function AppShellFrame({ children }: { children: ReactNode }) {
  const { user: me, isLoading } = useAuth();
  const { sidebarWidthPx } = useSidebarLayout();
  const isMd = useMediaMd();
  const isXl = useMediaXl();

  const mainPadLeft = isMd ? sidebarWidthPx : 0;
  const mainPadRight = isXl ? RIGHT_CHAT_RAIL_WIDTH_PX : 0;

  return (
    <div className="relative min-h-[100dvh] bg-bg-base">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          background: [
            "radial-gradient(ellipse 60% 35% at 12% -5%, rgba(125,211,252,0.04), transparent 50%)",
            "radial-gradient(ellipse 45% 25% at 90% 8%, rgba(0,200,150,0.03), transparent 45%)",
          ].join(", "),
        }}
      />

      {isMd && <Sidebar me={me} isLoading={isLoading} />}

      <Navbar />

      {isXl && <RightChatRail />}

      <motion.main
        className="relative z-[1] overflow-x-hidden"
        style={{
          paddingLeft: mainPadLeft,
          paddingRight: mainPadRight,
          paddingTop: NAVBAR_HEIGHT_PX,
          paddingBottom: isMd
            ? DESKTOP_BOTTOM_SPACE_PX
            : MOBILE_TAB_BAR_SPACE_PX,
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </motion.main>

      <MobileTabBar />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarLayoutProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </SidebarLayoutProvider>
  );
}
