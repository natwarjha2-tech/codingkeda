import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { processVideoHls } from "@/app/lib/hls-processor";

// Allow up to 5 minutes for FFmpeg processing
export const maxDuration = 300;

/**
 * POST /api/admin/video-process
 * Body: { mediaId: string }
 * Triggers HLS transcoding for an already-uploaded video.
 */
export async function POST(req: NextRequest) {
  const { error } = requireAdmin(req);
  if (error) return error;

  let mediaId: string;
  try {
    ({ mediaId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  if (media.type !== "VIDEO") {
    return NextResponse.json({ error: "HLS processing is only for videos" }, { status: 400 });
  }
  if (media.hlsStatus === "processing") {
    return NextResponse.json({ error: "Already processing" }, { status: 409 });
  }
  if (media.hlsStatus === "ready") {
    return NextResponse.json({ success: true, hlsMasterUrl: media.hlsMasterUrl, message: "Already processed" });
  }

  // Run in background — respond immediately
  processVideoHls(mediaId, media.s3Key, media.s3Url).catch((err) => {
    console.error(`[HLS] Processing failed for ${mediaId}:`, err);
  });

  return NextResponse.json({
    success: true,
    message: "HLS processing started",
    mediaId,
    status: "processing",
  });
}

/**
 * GET /api/admin/video-process?mediaId=xxx
 * Returns current processing status.
 */
export async function GET(req: NextRequest) {
  const { error } = requireAdmin(req);
  if (error) return error;

  const mediaId = req.nextUrl.searchParams.get("mediaId");
  if (!mediaId) return NextResponse.json({ error: "mediaId required" }, { status: 400 });

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, hlsStatus: true, hlsMasterUrl: true, hlsQualities: true },
  });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true, ...media });
}
