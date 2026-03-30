/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude browser-only packages from the SSR bundle so they are never
  // evaluated during prerendering of /_global-error, /_not-found, etc.
  serverExternalPackages: ["framer-motion", "socket.io-client", "canvas-confetti"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.rbxcdn.com", pathname: "/**" },
      { protocol: "https", hostname: "tr.rbxcdn.com", pathname: "/**" },
      { protocol: "https", hostname: "www.roblox.com", pathname: "/**" },
      { protocol: "https", hostname: "thumbnails.roblox.com", pathname: "/**" },
    ],
  },
  async rewrites() {
    const api =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://127.0.0.1:4000";
    return [
      { source: "/api/:path*", destination: `${api.replace(/\/$/, "")}/api/:path*` },
    ];
  },
};

export default nextConfig;
