import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "BloxyBet",
  description: "BloxyBet clone",
};

/** Inline only — avoids next/script injecting into <head>, which can trigger React key warnings with metadata. */
const THEME_INIT = `(function(){try{var t=localStorage.getItem('robloxbet-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="bg-bg-base text-text-primary">
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
