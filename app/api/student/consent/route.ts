import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { getConsentState } from "@/app/services/parent-consent.service";

/**
 * GET /api/student/consent
 * Does this student need a verified parent, what is done, and by when?
 * The apps call this after sign-in to decide whether to show the
 * "Parent verification" screen. Not blocked by the consent check itself.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    if (user!.role === "admin" || user!.role === "super-admin") {
      return apiSuccess({ consent: { enabled: false, required: false, verified: true, blocked: false, profile: { verified: true, missing: [] } } });
    }
    return apiSuccess({ consent: await getConsentState(user!.userId) });
  } catch (err) {
    logger.error("parent-consent", "get_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not load parent verification.");
  }
}
