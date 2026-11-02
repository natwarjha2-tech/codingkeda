import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { listMyRecordings } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/recordings/mine
 *
 * The requesting user's full recording library (P11), grouped as
 * Course → Class → Recording with time-limited signed playback URLs:
 *   • STUDENT  → recordings from their enrolled courses' classes
 *   • HOST     → recordings from the classes they host
 * Scope is derived server-side from the JWT identity (never trusted from the
 * client). Only ended classes with a ready recording are returned.
 *
 * Note: this is a STATIC path sibling of `[id]`, so Next.js matches it ahead of
 * the dynamic `[id]` segment — "recordings" is never treated as a class id.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const result = await listMyRecordings({ requesterId: user!.userId });

    if (!result.ok) {
      return apiError(result.status, result.message || "Failed to load recordings.");
    }
    return apiSuccess({ courses: result.data!.courses });
  } catch (err) {
    console.error("Live my-recordings error:", err);
    return apiError(500, "Internal server error.");
  }
}
