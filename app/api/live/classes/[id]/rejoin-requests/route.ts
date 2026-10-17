import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { listRejoinRequests } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/[id]/rejoin-requests
 *
 * Pending rejoin requests for the host to accept/reject (Phase 4). Host only.
 * The host client polls this (alongside the roster) to show the approval popup.
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

    const result = await listRejoinRequests({ requesterId: user!.userId, liveClassId: id.trim() });
    if (!result.ok) return apiError(result.status, result.message || "Failed to load requests.");
    return apiSuccess({ requests: result.data!.requests });
  } catch (err) {
    console.error("Live class rejoin-requests error:", err);
    return apiError(500, "Internal server error.");
  }
}
