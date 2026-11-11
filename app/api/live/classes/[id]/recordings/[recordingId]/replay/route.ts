import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { getRecordingReplay } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/[id]/recordings/[recordingId]/replay
 *
 * The class chat + floating reactions that happened during a recording, each
 * with `offsetSec` (its position in the recording video) so the player can
 * show them in sync with playback — chat/reactions are not part of the Chime
 * video itself. Read-only. Access: same as watching the recording.
 *
 * Response: { chat: [{ id, senderName, senderRole, message, offsetSec }],
 *             reactions: [{ emoji, offsetSec }] }
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

    const result = await getRecordingReplay({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      recordingId: recordingId.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to load replay.");
    return apiSuccess({ ...result.data! });
  } catch (err) {
    console.error("Live recording replay error:", err);
    return apiError(500, "Internal server error.");
  }
}
