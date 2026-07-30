import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/coins
 * Get user's total coins + recent transactions
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    // Get or create UserCoins record
    let userCoins = await prisma.userCoins.findUnique({
      where: { userId: user!.userId },
    });

    if (!userCoins) {
      userCoins = await prisma.userCoins.create({
        data: { userId: user!.userId, totalCoins: 0 },
      });
    }

    // Get recent transactions (last 20)
    const transactions = await prisma.coinTransaction.findMany({
      where: { userId: user!.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, coins: true, reason: true, createdAt: true },
    });

    // Get achievements
    const achievements = await prisma.achievement.findMany({
      where: { userId: user!.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, badgeType: true, lessonId: true, createdAt: true },
    });

    return apiSuccess({ totalCoins: userCoins.totalCoins, transactions, achievements });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
