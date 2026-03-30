import type { Metadata } from "next";
import "./globals.css";
import { ThemeInit } from "./ThemeInit";
import { Providers } from "./providers";

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
        <ThemeInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
