import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { joinLiveClass } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/[id]/join
 * Body: { clientType? }  // TEACHER_DESKTOP | STUDENT_DESKTOP | STUDENT_MOBILE
 *
 * Join a live class. Access: host, instructor, or enrolled student. Returns the
 * Chime Meeting + the caller's Attendee (JoinToken). Attendance recorded in the
 * service. The meetingId and attendee identity are derived server-side — never
 * trusted from the client (PDF §15).
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
    const { clientType } = body as { clientType?: string };

    const result = await joinLiveClass({
      requesterId: user!.userId,
      liveClassId: id.trim(),
      clientType,
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to join class.");
    return apiSuccess({
      liveClass: result.data!.liveClass,
      meeting: result.data!.meeting,
      attendee: result.data!.attendee,
    });
  } catch (err) {
    console.error("Live class join error:", err);
    return apiError(500, "Internal server error.");
  }
}
