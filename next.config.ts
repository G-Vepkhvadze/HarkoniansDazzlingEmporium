import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  allowedDevOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://192.168.0.107:3000",
    "http://192.168.0.107:3001",
  ],

  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        has: [
          {
            type: "host",
            value: "api.harkonians.quest",
          },
        ],
        destination: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;