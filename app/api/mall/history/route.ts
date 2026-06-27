import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/mall/history
 * Returns coin transaction history (earned + spent).
 * Used by: Desktop app Mall section, Mobile app
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    const userId = payload.userId;

    const transactions = await prisma.coinTransaction.findMany({
      where: { userId },
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

    const userCoins = await prisma.userCoins.findUnique({ where: { userId } });

    return NextResponse.json({
      success: true,
      balance: userCoins?.totalCoins || 0,
      transactions,
      totalEarned: transactions.filter(t => t.type === "EARNED").reduce((s, t) => s + t.coins, 0),
      totalSpent: transactions.filter(t => t.type === "SPENT").reduce((s, t) => s + t.coins, 0),
    });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
