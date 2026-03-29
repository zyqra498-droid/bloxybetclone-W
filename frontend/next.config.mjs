/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // framer-motion removed — its barrel-import optimization causes
    // Turbopack to evaluate React as null during /_global-error prerendering
    optimizePackageImports: ["recharts"],
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
      { source: "/api/:path*", destination: `${api}/api/:path*` },s
    ];
  },
};

export default nextConfig;
