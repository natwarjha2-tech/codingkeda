import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { FinalTestError, getAttemptReview } from "@/app/services/final-test.service";

/**
 * GET /api/final-test/review?attemptId=…
 * Review of one of the caller's past attempts (own answers, and the correct
 * answers + explanations once the course test has been passed).
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const attemptId = req.nextUrl.searchParams.get("attemptId")?.trim();
    if (!attemptId) return apiError(400, "attemptId is required.");
    return apiSuccess(await getAttemptReview(user!.userId, attemptId));
  } catch (err) {
    if (err instanceof FinalTestError) return apiError(err.status, err.message);
    logger.error("final-test", "review_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Internal server error.");
  }
}
