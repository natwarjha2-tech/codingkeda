import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the project root. Without this, a stray package-lock.json in a parent
  // folder (e.g. the server's home directory) makes Turbopack pick the wrong
  // root and every next/font import fails to resolve during `next build`.
  turbopack: { root: path.resolve(__dirname) },
  experimental: {
    serverActions: {
      bodySizeLimit: "600mb",
    },
  },
  // Allow long-running API routes for FFmpeg HLS processing
  serverExternalPackages: ["fluent-ffmpeg"],

  /**
   * API Versioning — /api/v1/ prefix support
   * 
   * Clients can use either:
   *   /api/v1/courses    → rewrites to /api/courses (same handler)
   *   /api/courses       → works directly (backward compatible)
   * 
   * When V2 is needed in the future:
   *   1. Create actual /api/v2/ route files with new logic
   *   2. Remove /api/v2/ from rewrites (so it hits the real files)
   *   3. /api/v1/ and /api/ continue serving V1 logic
   */
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
