import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Simple health check endpoint for network diagnostics.
 * Returns server time and status — no auth required.
 * Used by: Desktop app network diagnostics, Mobile app
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: Date.now(),
    serverTime: new Date().toISOString(),
    version: "1.0.0",
  });
}
