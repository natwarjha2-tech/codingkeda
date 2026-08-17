import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";

/**
 * GET /api/mall/history
 * Returns coin transaction history (earned + spent).
 * Used by: Desktop app Mall section, Mobile app
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const transactions = await prisma.coinTransaction.findMany({
      where: { userId: user!.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        coins: true,
        type: true,
        reason: true,
        createdAt: true,
      },
    });

    const userCoins = await prisma.userCoins.findUnique({ where: { userId: user!.userId } });

    return apiSuccess({
      balance: userCoins?.totalCoins || 0,
      transactions,
      totalEarned: transactions.filter(t => t.type === "EARNED").reduce((s, t) => s + t.coins, 0),
      totalSpent: transactions.filter(t => t.type === "SPENT").reduce((s, t) => s + t.coins, 0),
    });
  } catch (err) {
    logger.error("mall-history", "unhandled_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
