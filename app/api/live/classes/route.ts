import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { createLiveClass, listLiveClasses } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes?courseId=...
 *
 * List a course's live classes (newest first) for the admin management view.
 * Instructor/owner only (enforced in the service). Isolated, read-only.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const courseId = req.nextUrl.searchParams.get("courseId")?.trim();
    if (!courseId) return apiError(400, "courseId is required.");

    const result = await listLiveClasses({ requesterId: user!.userId, courseId });

    if (!result.ok) return apiError(result.status, result.message || "Failed to load classes.");
    return apiSuccess({ classes: result.data!.classes });
  } catch (err) {
    console.error("Live class list error:", err);
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST /api/live/classes
 * Body: { courseId, title?, instructorName?, durationMinutes?, agenda?, scheduledAt? }
 *
 * Schedule / create a live class for a course. Only the course instructor (or
 * creator) may create one — enforced in the service, never trusting the client.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const { courseId, title, instructorName, durationMinutes, agenda, scheduledAt } =
      body as {
        courseId?: string;
        title?: string;
        instructorName?: string;
        durationMinutes?: number | null;
        agenda?: string;
        scheduledAt?: string | null;
      };

    if (!courseId?.trim()) return apiError(400, "courseId is required.");

    const result = await createLiveClass({
      requesterId: user!.userId,
      courseId: courseId.trim(),
      title,
      instructorName,
      durationMinutes: durationMinutes ?? null,
      agenda,
      scheduledAt: scheduledAt ?? null,
    });

    if (!result.ok) return apiError(result.status, result.message || "Failed to create class.");
    return apiSuccess({ liveClass: result.data }, result.status);
  } catch (err) {
    console.error("Live class create error:", err);
    return apiError(500, "Internal server error.");
  }
}
