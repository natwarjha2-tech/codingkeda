import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * POST /api/coding-score/earn
 * 
 * Award coins for first-time successful coding problem submission.
 * Called from desktop app when user solves a coding practice problem.
 * 
 * Body: { problemId, problemTitle, difficulty, points, coins }
 * Duplicate prevention: checks if coins already earned for this problemId.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { problemId, problemTitle, difficulty, points, coins } = await req.json();

    if (!problemId || !coins || coins <= 0) {
      return apiError(400, "problemId and coins are required.");
    }

    // Duplicate prevention
    const existing = await prisma.coinTransaction.findFirst({
      where: { userId: user!.userId, reason: { contains: `Coding:${problemId}` }, type: "EARNED" },
    });

    if (existing) {
      return apiSuccess({ alreadyEarned: true, message: "Coins already earned for this problem." });
    }

    // Award coins (atomic transaction)
    const reason = `Coding:${problemId} — ${problemTitle || "Problem"} (${difficulty || "medium"}) +${points || 0}pts`;

    await prisma.$transaction([
      prisma.userCoins.upsert({
        where: { userId: user!.userId },
        update: { totalCoins: { increment: Number(coins) } },
        create: { userId: user!.userId, totalCoins: Number(coins) },
      }),
      prisma.coinTransaction.create({
        data: { userId: user!.userId, type: "EARNED", coins: Number(coins), reason },
      }),
    ]);

    return apiSuccess({ alreadyEarned: false, coinsAwarded: coins, message: `+${coins} coins earned!` });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
