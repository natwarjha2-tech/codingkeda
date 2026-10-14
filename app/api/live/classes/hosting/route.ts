import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { listHostingClasses } from "@/app/lib/live/live-service";

/**
 * GET /api/live/classes/hosting
 *
 * Teacher-facing: list scheduled + live classes the authenticated user hosts
 * (the account that scheduled them). Used by the desktop teacher view to
 * Start Now / Rejoin / End. Isolated, read-only.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const result = await listHostingClasses({ requesterId: user!.userId });

    if (!result.ok) return apiError(result.status, result.message || "Failed to load classes.");
    return apiSuccess({ classes: result.data!.classes });
  } catch (err) {
    console.error("Live class hosting list error:", err);
    return apiError(500, "Internal server error.");
  }
}
