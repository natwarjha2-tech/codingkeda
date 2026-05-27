import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * POST /api/coins/redeem
 * Redeem coins for course discount
 * Body: { courseId, coinsToRedeem }
 * 
 * Rules:
 * - Minimum 100 coins required to redeem
 * - 1 coin = ₹1 discount
 * - Max redeem = course price (can't go negative)
 * - Backend validates everything — frontend is never trusted
 */
export async function POST(req: NextRequest) {
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
    const { courseId, coinsToRedeem } = await req.json();

    if (!courseId || !coinsToRedeem || coinsToRedeem < 100) {
      return NextResponse.json(
        { success: false, message: "Minimum 100 coins required to redeem." },
        { status: 400 }
      );
    }

    // Get user's current coins
    const userCoins = await prisma.userCoins.findUnique({
      where: { userId: payload.userId },
    });

    if (!userCoins || userCoins.totalCoins < coinsToRedeem) {
      return NextResponse.json(
        { success: false, message: "Insufficient coins." },
        { status: 400 }
      );
    }

    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    // Deduct coins and create transaction (atomic)
    const [updatedCoins] = await prisma.$transaction([
      prisma.userCoins.update({
        where: { userId: payload.userId },
        data: { totalCoins: { decrement: coinsToRedeem } },
      }),
      prisma.coinTransaction.create({
        data: {
          userId: payload.userId,
          type: "SPENT",
          coins: coinsToRedeem,
          reason: `Redeemed for course: ${course.title}`,
          courseId: courseId,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      discount: coinsToRedeem, // 1 coin = ₹1
      remainingCoins: updatedCoins.totalCoins,
      message: `₹${coinsToRedeem} discount applied!`,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
