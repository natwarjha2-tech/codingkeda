import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { FinalTestError, startFinalTest } from "@/app/services/final-test.service";

/**
 * POST /api/final-test/start   body: { courseId }
 * Starts a new attempt (or resumes the open one). Returns the questions in
 * this attempt's order WITHOUT the correct answers, plus the server deadline.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    const courseId = typeof body?.courseId === "string" ? body.courseId.trim() : "";
    if (!courseId) return apiError(400, "courseId is required.");
    return apiSuccess(await startFinalTest(user!.userId, courseId));
  } catch (err) {
    if (err instanceof FinalTestError) return apiError(err.status, err.message);
    logger.error("final-test", "start_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Internal server error.");
  }
}
