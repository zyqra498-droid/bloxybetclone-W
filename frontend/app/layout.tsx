import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";

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
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
