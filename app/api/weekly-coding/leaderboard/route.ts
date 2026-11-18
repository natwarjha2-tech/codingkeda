import { NextRequest } from "next/server";
import { extractUser } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { currentWeek, weeklyLeaderboard } from "@/app/services/weekly-coding.service";

/**
 * GET /api/weekly-coding/leaderboard — this week's Weekly Coding Challenge:
 * who solved it, first solver first, with how many weeks each student has solved.
 */
export async function GET(req: NextRequest) {
  try {
    const me = extractUser(req);
    const week = currentWeek();
    const board = await weeklyLeaderboard(week.key, me?.userId ?? null);
    return apiSuccess({ week, ...board });
  } catch (err) {
    logger.error("weekly-coding", "leaderboard_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
