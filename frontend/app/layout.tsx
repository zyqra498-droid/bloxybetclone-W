import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";

// Load all providers client-side only — prevents framer-motion, socket.io,
// and other browser-only packages from being evaluated during SSR prerendering
const Providers = dynamic(
  () => import("./providers").then((m) => m.Providers),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "BloxyBet",
  description: "BloxyBet clone",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="bg-bg-base text-text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
