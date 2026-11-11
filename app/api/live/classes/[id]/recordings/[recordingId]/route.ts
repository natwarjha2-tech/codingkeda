import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { deleteRecording } from "@/app/lib/live/live-service";

/**
 * DELETE /api/live/classes/[id]/recordings/[recordingId]
 *
 * Host-only: deletes a recording's video files from S3 and marks the recording
 * "deleted" (the DB row is kept for audit; it disappears from all lists).
 * 403 for anyone who is not the class host; 409 while it is still recording.
 */
export async function DELETE(
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

    const result = await deleteRecording({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      recordingId: recordingId.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to delete recording.");
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("Live recording delete error:", err);
    return apiError(500, "Internal server error.");
  }
}
