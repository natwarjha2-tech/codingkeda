import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { requestRejoin } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/rejoin-request
 *
 * A removed participant asks the host to let them back in (Phase 4). Records a
 * pending request the host sees in the roster poll. No-op if not removed.
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

    const result = await requestRejoin({ requesterId: user!.userId, liveClassId: id.trim() });
    if (!result.ok) return apiError(result.status, result.message || "Failed to request rejoin.");
    return apiSuccess({ pending: result.data!.pending });
  } catch (err) {
    console.error("Live class rejoin-request error:", err);
    return apiError(500, "Internal server error.");
  }
}
