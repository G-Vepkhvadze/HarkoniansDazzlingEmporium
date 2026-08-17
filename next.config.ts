import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Allow development from localhost and local network
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://192.168.0.107:3000",
    "http://192.168.0.107:3001",
  ],
};

export default nextConfig;
