import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isRecordingConfigured } from "@/app/lib/live/live-config";
import { startRecording } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/recording/start
 *
 * Host starts recording the class (server-side Chime Media Capture Pipeline →
 * S3). Instructor-only (enforced in service). Idempotent: an already-active
 * recording is returned instead of starting a second pipeline.
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

    const result = await startRecording({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to start recording.");
    return apiSuccess({ recording: result.data }, result.status);
  } catch (err) {
    console.error("Live recording start error:", err);
    return apiError(500, "Internal server error.");
  }
}
