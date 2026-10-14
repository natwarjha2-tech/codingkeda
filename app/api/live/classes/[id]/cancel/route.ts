import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { cancelLiveClass } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/cancel
 *
 * Cancel a scheduled live class (instructor action). A running (live) class
 * must be ended instead; an ended class can't be cancelled. Idempotent.
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

    const result = await cancelLiveClass({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to cancel class.");
    return apiSuccess({ liveClass: result.data });
  } catch (err) {
    console.error("Live class cancel error:", err);
    return apiError(500, "Internal server error.");
  }
}
