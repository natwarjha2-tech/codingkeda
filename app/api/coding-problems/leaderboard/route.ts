import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
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
 * POST — Record submission and award ranking coins
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { problemId, problemTitle, qualityTag } = await req.json();
    if (!problemId) return apiError(400, "problemId is required.");

    // Check if user already has a leaderboard entry for this problem
    const existing = await prisma.coinTransaction.findFirst({
      where: {
        userId: user!.userId,
        reason: { contains: `CodingLB:${problemId}` },
        type: "EARNED",
      },
    });

    if (existing) {
      return apiSuccess({ alreadyRanked: true, message: "Already ranked for this problem." });
    }

    // Count how many users submitted before this user (determines rank)
    const previousSubmissions = await prisma.coinTransaction.count({
      where: {
        reason: { contains: `CodingLB:${problemId}` },
        type: "EARNED",
      },
    });

    const rank = previousSubmissions + 1;

    // Determine coins based on rank
    let coins = 0;
    if (rank <= 20) coins = 20;
    else if (rank <= 50) coins = 10;

    // Record leaderboard entry + award coins
    if (coins > 0) {
      const reason = `CodingLB:${problemId} — Rank #${rank} — ${problemTitle || "Problem"} (${qualityTag || "solved"})`;

      await prisma.$transaction([
        prisma.userCoins.upsert({
          where: { userId: user!.userId },
          update: { totalCoins: { increment: coins } },
          create: { userId: user!.userId, totalCoins: coins },
        }),
        prisma.coinTransaction.create({
          data: {
            userId: user!.userId,
            type: "EARNED",
            coins,
            reason,
          },
        }),
      ]);
    } else {
      // Still record entry (no coins, rank > 50)
      await prisma.coinTransaction.create({
        data: {
          userId: user!.userId,
          type: "EARNED",
          coins: 0,
          reason: `CodingLB:${problemId} — Rank #${rank} — ${problemTitle || "Problem"}`,
        },
      });
    }

    return apiSuccess({
      rank,
      coinsAwarded: coins,
      qualityTag: qualityTag || "green",
      message: coins > 0
        ? `Rank #${rank}! +${coins} coins earned!`
        : `Rank #${rank} — keep practicing!`,
    });
  } catch (err) {
    logger.error("coding-leaderboard", "post_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
