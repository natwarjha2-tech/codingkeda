import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/leaderboard?courseId=xxx
 * Get leaderboard for a course based on quiz performance
 */
export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json(
        { success: false, message: "courseId is required." },
        { status: 400 }
      );
    }

    // Get auth for current user rank
    let currentUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      try {
        const payload = verifyToken(token);
        currentUserId = payload.userId;
      } catch {}
    }

    // Get all quiz attempts for this course
    const allAttempts = await prisma.quizAttempt.findMany({
      where: { courseId },
      select: { userId: true, correct: true },
    });

    if (allAttempts.length === 0) {
      return NextResponse.json({
        success: true,
        leaderboard: [],
        currentUserRank: null,
        totalStudents: 0,
      });
    }

    // Group by user and calculate scores
    const userScores: Record<string, { total: number; correct: number }> = {};
    allAttempts.forEach((a) => {
      if (!userScores[a.userId]) userScores[a.userId] = { total: 0, correct: 0 };
      userScores[a.userId].total++;
      if (a.correct) userScores[a.userId].correct++;
    });

    // Build leaderboard
    const leaderboardRaw = Object.entries(userScores).map(([userId, data]) => ({
      userId,
      score: Math.round((data.correct / data.total) * 100),
      totalAttempts: data.total,
      correctCount: data.correct,
    }));

    // Sort by score descending
    leaderboardRaw.sort((a, b) => b.score - a.score || b.correctCount - a.correctCount);

    // Get user names for top 20
    const topUsers = leaderboardRaw.slice(0, 20);
    const userIds = topUsers.map((u) => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const leaderboard = topUsers.map((entry, index) => ({
      rank: index + 1,
      name: userMap.get(entry.userId) || "Student",
      score: entry.score,
      totalAttempts: entry.totalAttempts,
      correctCount: entry.correctCount,
      isCurrentUser: entry.userId === currentUserId,
    }));

    // Find current user's rank
    let currentUserRank = null;
    if (currentUserId) {
      const userIndex = leaderboardRaw.findIndex((e) => e.userId === currentUserId);
      if (userIndex !== -1) {
        currentUserRank = {
          rank: userIndex + 1,
          score: leaderboardRaw[userIndex].score,
          totalStudents: leaderboardRaw.length,
        };
      }
    }

    return NextResponse.json({
      success: true,
      leaderboard,
      currentUserRank,
      totalStudents: leaderboardRaw.length,
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
