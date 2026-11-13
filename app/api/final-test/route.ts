import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { FinalTestError, getFinalTestStatus } from "@/app/services/final-test.service";

/**
 * GET /api/final-test?courseId=…
 * Status for the course's Final Test card: availability, unlock (all lessons
 * completed), attempts / best score, retake cooldown, in-progress attempt and
 * the certificate (if issued) or a pending one waiting for name confirmation.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const courseId = req.nextUrl.searchParams.get("courseId")?.trim();
    if (!courseId) return apiError(400, "courseId is required.");
    const status = await getFinalTestStatus(user!.userId, courseId);
    return apiSuccess(status);
  } catch (err) {
    if (err instanceof FinalTestError) return apiError(err.status, err.message);
    logger.error("final-test", "status_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Internal server error.");
  }
}
