import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { listRecordings } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/[id]/recordings
 *
 * List a class's recordings with time-limited signed S3 URLs. Access: host,
 * instructor, or enrolled student (recordings are member content). Gated on the
 * base live-class config (listing works even if start/stop config is partial).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const { id } = await params;
    if (!id?.trim()) return apiError(400, "Class id is required.");

    const result = await listRecordings({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to load recordings.");
    return apiSuccess({ recordings: result.data!.recordings });
  } catch (err) {
    console.error("Live recordings list error:", err);
    return apiError(500, "Internal server error.");
  }
}
