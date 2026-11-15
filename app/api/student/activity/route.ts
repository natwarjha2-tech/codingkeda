import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { eachDate } from "@/app/lib/ist";
import { getStudentDays } from "@/app/services/day-activity.service";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 62;

/**
 * GET /api/student/activity?from=YYYY-MM-DD&to=YYYY-MM-DD
 * What the signed-in student did on each day (time, lessons, quizzes, exercises,
 * coins, badges). Used by the calendar day popup in the apps; the weekly parent
 * report is built from the same data.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const from = req.nextUrl.searchParams.get("from") ?? "";
    const to = req.nextUrl.searchParams.get("to") ?? from;
    if (!DATE.test(from) || !DATE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
      return apiError(400, "Use from and to as YYYY-MM-DD.");
    }
    const dates = eachDate(from, to);
    if (dates.length === 0 || dates.length > MAX_DAYS) {
      return apiError(400, `Ask for between 1 and ${MAX_DAYS} days.`);
    }

    return apiSuccess({ days: await getStudentDays(user!.userId, dates) });
  } catch (err) {
    logger.error("activity", "load_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not load activity.");
  }
}
