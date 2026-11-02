import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { listParticipants } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/[id]/attendance
 *
 * Full attendance record for a class — EVERY user who ever joined (host +
 * students), regardless of whether they have since left. Powers the post-class
 * "Summary" (actual joined count + a name/email roster) on the admin course
 * page (P10). This is distinct from GET .../participants, which returns only
 * the CURRENTLY-present roster (leftAt null) for the live panel — after a class
 * ends everyone has left, which is why the live roster shows 0.
 *
 * Access: HOST / course instructor ONLY (enforced in the service). The roster
 * includes email (PII), so it is never exposed to students.
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

    const result = await listParticipants({
      requesterId: user!.userId,
      liveClassId: id.trim(),
    });

    if (!result.ok) {
      return apiError(result.status, result.message || "Failed to load attendance.");
    }

    const participants = result.data!.participants;
    return apiSuccess({
      participants,
      count: participants.length,
    });
  } catch (err) {
    console.error("Live class attendance error:", err);
    return apiError(500, "Internal server error.");
  }
}
