import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { currentWeek, weeklyExercise, solvedThisWeek, WEEKLY_CODE_COINS } from "@/app/services/weekly-coding.service";
import { XP_REWARDS } from "@/app/services/xp.service";
import { MEDALS } from "@/app/lib/medals";

/** The medal saved in the reward's reason text ("… — Weekly Champion — …"). */
function medalFromReason(reason: string) {
  const m = Object.values(MEDALS).find((x) => x.key.startsWith("weekly-") && reason.includes(x.label));
  return m ? { key: m.key, label: m.label, icon: m.icon } : { key: "weekly-solver", label: "Weekly Solver", icon: "✅" };
}

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
      reward: WEEKLY_CODE_COINS, // up to (first solver)
      rewards: { champion: 15, finalist: 10, solver: 5 },
      xp: XP_REWARDS.weekly,
      completed: !!done,
      completedAt: done?.createdAt ?? null,
      coinsEarned: done?.coins ?? 0,
      medal: done ? medalFromReason(done.reason) : null,
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
