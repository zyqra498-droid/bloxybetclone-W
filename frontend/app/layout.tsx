import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { AppShellGate } from "@/components/layout/AppShellGate";
import { AppToaster } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-rajdhani",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RobloxBet — Provably fair games",
  description: "Coinflip, jackpot, Roblox Limiteds market, and inventory-backed play.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable}`}>
      <body className="bg-bg-base text-text-primary antialiased">
        <AuthProvider>
          <ToastProvider>
            <AppShellGate>{children}</AppShellGate>
          </ToastProvider>
          <AppToaster />
        </AuthProvider>
      </body>
    </html>
  );
}
