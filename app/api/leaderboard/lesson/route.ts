import { NextRequest } from "next/server";
import { extractUser } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { lessonQuizLeaderboard, lessonExerciseLeaderboard } from "@/app/services/leaderboard.service";

/**
 * GET /api/leaderboard/lesson?lessonId=xxx&type=quiz|exercise
 * Leaderboard for ONE lesson: everyone who attempted its quiz (type=quiz) or its
 * coding exercises (type=exercise). Auth optional (used to mark "You").
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    const type = req.nextUrl.searchParams.get("type") === "exercise" ? "exercise" : "quiz";
    if (!lessonId) return apiError(400, "lessonId is required.");

    const me = extractUser(req)?.userId ?? null;
    const board = type === "exercise"
      ? await lessonExerciseLeaderboard(lessonId, me)
      : await lessonQuizLeaderboard(lessonId, me);

    return apiSuccess({ type, ...board });
  } catch (err) {
    logger.error("lesson-leaderboard", "get_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
