import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { recordHostHeartbeat } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/heartbeat
 *
 * Host-only liveness ping (Phase 3). While a class is live, the host's client
 * calls this periodically so the server knows the host is still present. A
 * stale-sweep auto-ends a live class whose host hasn't pinged within the grace
 * window (host crash/close → no ghost classes, no leaked Chime meetings).
 *
 * Authorization + "is this really the host / is the class live" are enforced in
 * the service; a non-host or non-live call is a silent no-op success.
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

    const result = await recordHostHeartbeat({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) return apiError(result.status, result.message || "Heartbeat failed.");
    return apiSuccess({ ok: result.data!.ok });
  } catch (err) {
    console.error("Live heartbeat error:", err);
    return apiError(500, "Internal server error.");
  }
}
