import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { FinalTestError, submitFinalTest } from "@/app/services/final-test.service";

/**
 * POST /api/final-test/submit   body: { attemptId, answers: { [quizId]: optionIndex } }
 * Grades on the server. Response: score, percent, passed, review (correct
 * answers only revealed when passed), needsCertificate + suggestedName.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    const attemptId = typeof body?.attemptId === "string" ? body.attemptId.trim() : "";
    if (!attemptId) return apiError(400, "attemptId is required.");
    return apiSuccess(await submitFinalTest(user!.userId, attemptId, body?.answers));
  } catch (err) {
    if (err instanceof FinalTestError) return apiError(err.status, err.message);
    logger.error("final-test", "submit_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Internal server error.");
  }
}
