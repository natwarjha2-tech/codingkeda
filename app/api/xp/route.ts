import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { getStudentXp } from "@/app/services/xp.service";

/**
 * GET /api/xp — the student's XP and level (worked out from what they did),
 * plus how XP is earned, so every app shows the same numbers.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    return apiSuccess({ xp: await getStudentXp(user!.userId) });
  } catch (err) {
    logger.error("xp", "get_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
