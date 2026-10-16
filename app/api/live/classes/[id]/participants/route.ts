import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { listLiveParticipants } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/[id]/participants
 *
 * Current participants (joined, not left) of a live class — the roster that
 * powers the Zoom-style participants panel. Access: host, instructor, or
 * enrolled student (enforced in the service). Identity (name + avatar) is
 * resolved server-side; the client never supplies it. Mirrors the thin-route
 * convention used by the other /api/live/* endpoints.
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

    const result = await listLiveParticipants({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) {
      return apiError(result.status, result.message || "Failed to load participants.");
    }
    return apiSuccess({ participants: result.data!.participants });
  } catch (err) {
    console.error("Live class participants error:", err);
    return apiError(500, "Internal server error.");
  }
}
