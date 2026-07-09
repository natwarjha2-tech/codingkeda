import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/coding-problems/leaderboard?problemId=xxx
 * 
 * Returns leaderboard for a specific coding problem.
 * Ranks users by: solution quality (TC match) → submission time (earlier = better)
 * 
 * POST /api/coding-problems/leaderboard
 * Submit user's ranking entry after successful submission.
 * Awards coins: Top 20 = 20 coins, Rank 21-50 = 10 coins.
 * 
 * Body: { problemId, problemTitle, qualityTag, userId? }
 */

export async function GET(req: NextRequest) {
  try {
    const problemId = req.nextUrl.searchParams.get("problemId");
    if (!problemId) {
      return NextResponse.json(
        { success: false, message: "problemId is required." },
        { status: 400 }
      );
    }

    // Fetch all submissions for this problem from CoinTransaction
    // (we store coding submissions as coin transactions with reason containing problemId)
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

    return NextResponse.json({
      success: true,
      problemId,
      leaderboard: leaderboard.slice(0, 50),
      totalParticipants: leaderboard.length,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST — Record submission and award ranking coins
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
    const { problemId, problemTitle, qualityTag } = await req.json();

    if (!problemId) {
      return NextResponse.json(
        { success: false, message: "problemId is required." },
        { status: 400 }
      );
    }

    // Check if user already has a leaderboard entry for this problem
    const existing = await prisma.coinTransaction.findFirst({
      where: {
        userId: payload.userId,
        reason: { contains: `CodingLB:${problemId}` },
        type: "EARNED",
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyRanked: true,
        message: "Already ranked for this problem.",
      });
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
          where: { userId: payload.userId },
          update: { totalCoins: { increment: coins } },
          create: { userId: payload.userId, totalCoins: coins },
        }),
        prisma.coinTransaction.create({
          data: {
            userId: payload.userId,
            type: "EARNED",
            coins: coins,
            reason: reason,
          },
        }),
      ]);
    } else {
      // Still record entry (no coins, rank > 50)
      await prisma.coinTransaction.create({
        data: {
          userId: payload.userId,
          type: "EARNED",
          coins: 0,
          reason: `CodingLB:${problemId} — Rank #${rank} — ${problemTitle || "Problem"}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      rank: rank,
      coinsAwarded: coins,
      qualityTag: qualityTag || "green",
      message: coins > 0
        ? `Rank #${rank}! +${coins} coins earned!`
        : `Rank #${rank} — keep practicing!`,
    });
  } catch (err: any) {
    if (err?.message?.includes("jwt") || err?.message?.includes("token")) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
