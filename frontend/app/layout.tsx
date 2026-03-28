import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="bg-bg-base text-text-primary">
        {children}
      </body>
    </html>
  );
}
