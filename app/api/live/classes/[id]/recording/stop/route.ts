import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isRecordingConfigured } from "@/app/lib/live/live-config";
import { stopRecording } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/recording/stop
 *
 * Host stops the active recording (stops the Chime pipeline, marks the
 * recording ready, points the class at its latest recording). Instructor-only
 * (enforced in service). Idempotent.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isRecordingConfigured()) {
      return apiError(503, "Recording is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const { id } = await params;
    if (!id?.trim()) return apiError(400, "Class id is required.");

    const result = await stopRecording({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to stop recording.");
    return apiSuccess({ recording: result.data });
  } catch (err) {
    console.error("Live recording stop error:", err);
    return apiError(500, "Internal server error.");
  }
}
