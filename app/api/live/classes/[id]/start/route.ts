import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { startLiveClass } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/start
 *
 * Teacher starts the class: creates the Chime meeting (idempotent) and flips
 * status → "live". Only the host/instructor may start (enforced in service).
 * Returns the Chime Meeting object the client SDK needs to connect.
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

    const result = await startLiveClass({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to start class.");
    return apiSuccess({
      liveClass: result.data!.liveClass,
      meeting: result.data!.meeting,
    });
  } catch (err) {
    console.error("Live class start error:", err);
    return apiError(500, "Internal server error.");
  }
}
