import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "BloxyBet",
  description: "BloxyBet clone",
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem('robloxbet-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="bg-bg-base text-text-primary">
        <Script id="robloxbet-theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
