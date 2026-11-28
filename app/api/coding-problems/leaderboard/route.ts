import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { extractUser, requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { realUsersOr } from "@/app/lib/guest";
import { awardSolveCoins } from "@/app/services/exercise-coins.service";
import { logger } from "@/app/lib/logger";

/**
 * GET /api/coding-problems/leaderboard?problemId=xxx
 * 
 * Returns leaderboard for a specific coding problem.
 * Ranks users by: submission order (earlier = better rank)
 * 
 * POST /api/coding-problems/leaderboard
 * Submit user's ranking entry after successful submission.
 * Awards coins: Top 20 = 20 coins, Rank 21-50 = 10 coins.
 * 
 * Body: { problemId, problemTitle, qualityTag }
 */

export async function GET(req: NextRequest) {
  try {
    const problemId = req.nextUrl.searchParams.get("problemId");
    if (!problemId) return apiError(400, "problemId is required.");

    // Fetch all submissions for this problem from CoinTransaction
    const transactions = await prisma.coinTransaction.findMany({
      where: {
        reason: { contains: `Coding:${problemId}` },
        type: "EARNED",
        ...realUsersOr(extractUser(req)?.userId), // guests hidden from others
      },
      orderBy: { createdAt: "asc" },
      select: {
        userId: true,
        coins: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });

    // Build leaderboard — first submission per user only
    const seen = new Set<string>();
    const leaderboard: {
      rank: number;
      name: string;
      coins: number;
      submittedAt: string;
    }[] = [];

    for (const tx of transactions) {
      if (seen.has(tx.userId)) continue;
      seen.add(tx.userId);
      leaderboard.push({
        rank: leaderboard.length + 1,
        name: tx.user?.name || "Student",
        coins: tx.coins,
        submittedAt: tx.createdAt.toISOString(),
      });
    }

    return apiSuccess({
      problemId,
      leaderboard: leaderboard.slice(0, 50),
      totalParticipants: leaderboard.length,
    });
  } catch (err) {
    logger.error("coding-leaderboard", "get_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST — Record a solve and award ranking coins (first solve only).
 * Logic is shared with /api/code/submit (awardSolveCoins), which pays lesson
 * exercises after the server checked every test.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { problemId, problemTitle, qualityTag, lessonId, courseId } = await req.json();
    if (!problemId) return apiError(400, "problemId is required.");

    const r = await awardSolveCoins({
      userId: user!.userId, problemId: String(problemId), problemTitle, qualityTag, lessonId, courseId,
    });
    if (r.alreadyRanked) return apiSuccess({ alreadyRanked: true, message: "Already ranked for this problem." });

    return apiSuccess({
      rank: r.rank,
      coinsAwarded: r.coinsAwarded,
      qualityTag: qualityTag || "green",
      message: r.coinsAwarded > 0 ? `Rank #${r.rank}! +${r.coinsAwarded} coins earned!` : `Rank #${r.rank} — keep practicing!`,
    });
  } catch (err) {
    logger.error("coding-leaderboard", "post_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
