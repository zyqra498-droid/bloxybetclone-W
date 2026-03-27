/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Cuts dev cold-compile work for heavy barrel packages (fewer modules in first graph). */
  experimental: {
    optimizePackageImports: ["recharts", "framer-motion"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.rbxcdn.com", pathname: "/**" },
      { protocol: "https", hostname: "tr.rbxcdn.com", pathname: "/**" },
      { protocol: "https", hostname: "www.roblox.com", pathname: "/**" },
      { protocol: "https", hostname: "thumbnails.roblox.com", pathname: "/**" },
    ],
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
    ];
  },
};

export default nextConfig;
