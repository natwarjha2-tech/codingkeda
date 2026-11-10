import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { getRecordingHlsAuth } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/[id]/recordings/[recordingId]/hls-auth
 *
 * HLS playback auth for a live-class recording — the SAME model as lesson
 * videos (/api/lessons/[id]/hls-auth): returns the CloudFront master playlist
 * URL + signed cookies scoped to ONLY this recording's hls/live-<id>/ folder,
 * so the player streams it segment by segment from the CDN.
 *
 * Response: { hlsReady, hlsStatus, masterUrl, cookies, expiresIn }
 *   hlsReady=false + hlsStatus "processing"/"pending" → still being prepared
 *   (the conversion is started automatically if it hadn't been).
 * Access: host, instructor, or enrolled student of the class's course.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; recordingId: string }> }
) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const { id, recordingId } = await params;
    if (!id?.trim() || !recordingId?.trim()) {
      return apiError(400, "Class id and recording id are required.");
    }

    const result = await getRecordingHlsAuth({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      recordingId: recordingId.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to load recording.");
    return apiSuccess({ ...result.data! });
  } catch (err) {
    console.error("Live recording hls-auth error:", err);
    return apiError(500, "Internal server error.");
  }
}
