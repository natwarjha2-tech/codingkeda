import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSignedHlsUrl } from "@/app/lib/s3";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/media/:id/hls
 *
 * Returns HLS streaming info for a video.
 * - If HLS is ready: returns master playlist URL (signed or public)
 * - If still processing: returns status so client can poll
 * - Falls back gracefully to original MP4 URL if HLS not available
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check — same pattern as existing signed-url endpoint (non-blocking)
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      try { verifyToken(token); } catch { /* expired/invalid — continue */ }
    }

    const media = await prisma.media.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        type: true,
        hlsStatus: true,
        hlsMasterUrl: true,
        hlsQualities: true,
        hlsS3Prefix: true,
        s3Key: true,
        s3Url: true,
      },
    });

    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (media.type !== "VIDEO") {
      return NextResponse.json({ error: "Not a video" }, { status: 400 });
    }

    // HLS is ready — return master URL
    if (media.hlsStatus === "ready" && media.hlsMasterUrl) {
      const useSigned = req.nextUrl.searchParams.get("signed") === "true";
      let masterUrl = media.hlsMasterUrl;

      if (useSigned && media.hlsS3Prefix) {
        // Sign the master playlist key
        masterUrl = await getSignedHlsUrl(`${media.hlsS3Prefix}/master.m3u8`, 3600);
      }

      return NextResponse.json({
        success: true,
        hlsReady: true,
        masterUrl,
        qualities: media.hlsQualities,
        status: "ready",
      });
    }

    // HLS not ready yet — return status + fallback original URL
    return NextResponse.json({
      success: true,
      hlsReady: false,
      masterUrl: null,
      qualities: [],
      status: media.hlsStatus || "none",
      fallbackUrl: media.s3Url,  // client can play MP4 while HLS is being processed
    });
  } catch (error) {
    console.error("HLS info error:", error);
    return NextResponse.json({ error: "Failed to get HLS info" }, { status: 500 });
  }
}
