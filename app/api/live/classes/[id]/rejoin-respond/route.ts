import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { respondRejoin } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/rejoin-respond
 * Body: { targetUserId, accept: boolean }
 *
 * Host accepts/rejects a removed user's rejoin request (Phase 4). Host only.
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
    const { targetUserId, accept } = body as { targetUserId?: string; accept?: boolean };
    if (!targetUserId?.trim()) return apiError(400, "targetUserId is required.");

    const result = await respondRejoin({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      targetUserId: targetUserId.trim(),
      accept: !!accept,
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to respond.");
    return apiSuccess({ targetUserId: result.data!.targetUserId, accepted: result.data!.accepted });
  } catch (err) {
    console.error("Live class rejoin-respond error:", err);
    return apiError(500, "Internal server error.");
  }
}
