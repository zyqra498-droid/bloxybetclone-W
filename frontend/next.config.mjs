/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
