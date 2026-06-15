import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "600mb",
    },
  },
  // Allow long-running API routes for FFmpeg HLS processing
  serverExternalPackages: ["fluent-ffmpeg"],
};

export default nextConfig;
