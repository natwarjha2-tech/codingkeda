import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { getCodingMedals, getCodingSubmissions } from "@/app/services/coding-medals.service";

/**
 * GET /api/coding-badges — the student's coding medals (lesson exercises and
 * weekly challenges) and the coins earned from coding only.
 * Read from the coin records, so nothing new is stored.
 *   { badges: [{ key, label, icon, title, coins, earnedAt }], codingCoins, counts }
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const [{ badges, codingCoins, history }, submissions] = await Promise.all([
      getCodingMedals(user!.userId),
      getCodingSubmissions(user!.userId),
    ]);
    const counts: Record<string, number> = {};
    for (const b of badges) counts[b.key] = (counts[b.key] ?? 0) + 1;

    return apiSuccess({ badges, codingCoins, counts, history, submissions });
  } catch (err) {
    logger.error("coding-badges", "get_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
