import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { processVideoHls } from "@/app/lib/hls-processor";

export const maxDuration = 300;

/**
 * POST /api/admin/video-process
 * Body: { mediaId } — Triggers HLS transcoding for an uploaded video.
 */
export async function POST(req: NextRequest) {
  const { error } = requireAdmin(req);
  if (error) return error;

  let mediaId: string;
  try { ({ mediaId } = await req.json()); } catch { return apiError(400, "Invalid request body"); }
  if (!mediaId) return apiError(400, "mediaId is required");

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return apiError(404, "Media not found");
  if (media.type !== "VIDEO") return apiError(400, "HLS processing is only for videos");
  if (media.hlsStatus === "processing") return apiError(409, "Already processing");
  if (media.hlsStatus === "ready") return apiSuccess({ hlsMasterUrl: media.hlsMasterUrl, message: "Already processed" });

  processVideoHls(mediaId, media.s3Key, media.s3Url).catch((err) => {
    console.error(`[HLS] Processing failed for ${mediaId}:`, err);
  });

  return apiSuccess({ message: "HLS processing started", mediaId, status: "processing" });
}

/**
 * GET /api/admin/video-process?mediaId=xxx — Returns processing status.
 */
export async function GET(req: NextRequest) {
  const { error } = requireAdmin(req);
  if (error) return error;

  const mediaId = req.nextUrl.searchParams.get("mediaId");
  if (!mediaId) return apiError(400, "mediaId required");

  const media = await prisma.media.findUnique({ where: { id: mediaId }, select: { id: true, hlsStatus: true, hlsMasterUrl: true, hlsQualities: true } });
  if (!media) return apiError(404, "Not found");

  return apiSuccess({ ...media });
}
