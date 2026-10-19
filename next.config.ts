import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    // The Services deployment currently returns 404 for /_next/image even
    // when the source image exists. Serve originals on Vercel until that
    // optimizer route is available; keep local/self-hosted optimization.
    unoptimized: Boolean(process.env.VERCEL),
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/v1/:path*",
          destination: "http://127.0.0.1:8000/api/v1/:path*",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
