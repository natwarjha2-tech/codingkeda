import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { listStudentClasses } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/enrolled
 *
 * Student-facing: list scheduled + live classes across the courses the
 * authenticated user is enrolled in. Used by the desktop/mobile "Live Classes"
 * screen so students see what they can join. Isolated, read-only.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const result = await listStudentClasses({ requesterId: user!.userId });

    if (!result.ok) return apiError(result.status, result.message || "Failed to load classes.");
    return apiSuccess({ classes: result.data!.classes });
  } catch (err) {
    console.error("Live class enrolled list error:", err);
    return apiError(500, "Internal server error.");
  }
}
