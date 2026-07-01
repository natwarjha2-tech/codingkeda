import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * POST /api/coding-score/earn
 * 
 * Award coins for first-time successful coding problem submission.
 * Called from desktop app when user solves a coding practice problem.
 * 
 * Body: { problemId, problemTitle, difficulty, points, coins }
 * 
 * Duplicate prevention: checks if coins already earned for this problemId.
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
    const { problemId, problemTitle, difficulty, points, coins } =
      await req.json();

    if (!problemId || !coins || coins <= 0) {
      return NextResponse.json(
        { success: false, message: "problemId and coins are required." },
        { status: 400 }
      );
    }

    // Duplicate prevention — check if already earned for this problem
    const existing = await prisma.coinTransaction.findFirst({
      where: {
        userId: payload.userId,
        reason: { contains: `Coding:${problemId}` },
        type: "EARNED",
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyEarned: true,
        message: "Coins already earned for this problem.",
      });
    }

    // Award coins (atomic transaction)
    const reason = `Coding:${problemId} — ${problemTitle || "Problem"} (${difficulty || "medium"}) +${points || 0}pts`;

    await prisma.$transaction([
      prisma.userCoins.upsert({
        where: { userId: payload.userId },
        update: { totalCoins: { increment: Number(coins) } },
        create: { userId: payload.userId, totalCoins: Number(coins) },
      }),
      prisma.coinTransaction.create({
        data: {
          userId: payload.userId,
          type: "EARNED",
          coins: Number(coins),
          reason: reason,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      alreadyEarned: false,
      coinsAwarded: coins,
      message: `+${coins} coins earned!`,
    });
  } catch (err: any) {
    if (
      err?.message?.includes("jwt") ||
      err?.message?.includes("token") ||
      err?.message?.includes("invalid")
    ) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }
    console.error("Coding score earn error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
