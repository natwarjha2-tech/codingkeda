import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { currentWeek, weeklyExercise, solvedThisWeek, WEEKLY_CODE_COINS } from "@/app/services/weekly-coding.service";

/**
 * GET /api/weekly-coding — this week's coding challenge (same for every student).
 * { week: { key, start, end }, reward, exercise | null, completed, completedAt }
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const week = currentWeek();
    const [ex, done] = await Promise.all([weeklyExercise(week.key), solvedThisWeek(user!.userId, week.key)]);
    return apiSuccess({
      week,
      reward: WEEKLY_CODE_COINS,
      completed: !!done,
      completedAt: done?.createdAt ?? null,
      exercise: ex
        ? {
            id: ex.id,
            title: ex.title,
            description: ex.description,
            difficulty: ex.difficulty,
            language: ex.language,
            starterCode: ex.starterCode,
            inputFormat: ex.inputFormat,
            outputFormat: ex.outputFormat,
            constraints: ex.constraints,
            hints: ex.hints,
            lessonId: ex.lessonId,
            courseId: ex.lesson?.module?.courseId ?? null,
            courseTitle: ex.lesson?.module?.course?.title ?? null,
            samples: ex.testCases,
          }
        : null,
    });
  } catch (err) {
    logger.error("weekly-coding", "get_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
