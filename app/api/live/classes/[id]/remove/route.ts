import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { removeParticipant } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/remove
 * Body: { targetUserId }
 *
 * Host FORCE-REMOVE (Phase 4): remove a participant from the class. Host only.
 * Marks the row removed so a later join needs host approval.
 */
export async function POST(
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

    const body = await req.json().catch(() => ({}));
    const { targetUserId } = body as { targetUserId?: string };
    if (!targetUserId?.trim()) return apiError(400, "targetUserId is required.");

    const result = await removeParticipant({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      targetUserId: targetUserId.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to remove participant.");
    return apiSuccess({ targetUserId: result.data!.targetUserId });
  } catch (err) {
    console.error("Live class remove error:", err);
    return apiError(500, "Internal server error.");
  }
}
