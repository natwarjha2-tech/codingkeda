import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/coins
 * Get user's total coins + recent transactions
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    // Get or create UserCoins record
    let userCoins = await prisma.userCoins.findUnique({
      where: { userId: payload.userId },
    });

    if (!userCoins) {
      userCoins = await prisma.userCoins.create({
        data: { userId: payload.userId, totalCoins: 0 },
      });
    }

    // Get recent transactions (last 20)
    const transactions = await prisma.coinTransaction.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        coins: true,
        reason: true,
        createdAt: true,
      },
    });

    // Get achievements
    const achievements = await prisma.achievement.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        badgeType: true,
        lessonId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      totalCoins: userCoins.totalCoins,
      transactions,
      achievements,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
