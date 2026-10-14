import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { leaveLiveClass } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/leave
 *
 * Mark the authenticated caller as having left the class (attendance). Idempotent
 * and best-effort: a user who never joined simply gets { left: false }.
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

    const result = await leaveLiveClass({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to leave class.");
    return apiSuccess({ left: result.data!.left });
  } catch (err) {
    console.error("Live class leave error:", err);
    return apiError(500, "Internal server error.");
  }
}
