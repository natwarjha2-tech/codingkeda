import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/leaderboard?courseId=xxx&lessonId=yyy
 * Get leaderboard for a course or specific lesson based on quiz performance
 * 
 * Ranking priority (production standard):
 * 1. Higher Score (correct/total %)
 * 2. More correct answers (tiebreaker)
 * 3. Earlier submission (tiebreaker)
 * 
 * If lessonId is provided → lesson-level leaderboard
 * If only courseId → course-level leaderboard (backward compatible)
 */
export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get("courseId");
    const lessonId = req.nextUrl.searchParams.get("lessonId");

    if (!courseId && !lessonId) {
      return NextResponse.json(
        { success: false, message: "courseId or lessonId is required." },
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

    // Build query filter — lessonId takes priority (lesson-specific leaderboard)
    // If lessonId returns no results, the response will be empty (lesson-specific is strict)
    const whereClause: Record<string, string | undefined> = {};
    if (lessonId) {
      whereClause.lessonId = lessonId;
    } else if (courseId) {
      whereClause.courseId = courseId;
    }

    // Get all quiz attempts matching filter
    let allAttempts = await prisma.quizAttempt.findMany({
      where: whereClause,
      select: { userId: true, correct: true, createdAt: true, timeTaken: true },
    });

    // Fallback: if lessonId query returns empty, try finding attempts via Quiz→Lesson relationship
    if (allAttempts.length === 0 && lessonId) {
      const quizzesForLesson = await prisma.quiz.findMany({
        where: { lessonId },
        select: { id: true },
      });
      if (quizzesForLesson.length > 0) {
        const quizIds = quizzesForLesson.map(q => q.id);
        allAttempts = await prisma.quizAttempt.findMany({
          where: { quizId: { in: quizIds } },
          select: { userId: true, correct: true, createdAt: true, timeTaken: true },
        });
      }
    }

    if (allAttempts.length === 0) {
      return NextResponse.json({
        success: true,
        leaderboard: [],
        currentUserRank: null,
        totalStudents: 0,
      });
    }

    // Group by user and calculate scores
    const userScores: Record<string, { total: number; correct: number; earliestSubmit: Date; totalTime: number }> = {};
    allAttempts.forEach((a) => {
      if (!userScores[a.userId]) {
        userScores[a.userId] = { total: 0, correct: 0, earliestSubmit: a.createdAt, totalTime: 0 };
      }
      userScores[a.userId].total++;
      if (a.correct) userScores[a.userId].correct++;
      if (a.timeTaken) userScores[a.userId].totalTime += a.timeTaken;
      if (a.createdAt < userScores[a.userId].earliestSubmit) {
        userScores[a.userId].earliestSubmit = a.createdAt;
      }
    });

    // Build leaderboard with ranking priority: score > correct count > less time > earlier submission
    const leaderboardRaw = Object.entries(userScores).map(([userId, data]) => ({
      userId,
      score: Math.round((data.correct / data.total) * 100),
      totalAttempts: data.total,
      correctCount: data.correct,
      totalTime: data.totalTime,
      earliestSubmit: data.earliestSubmit,
    }));

    // Sort: score DESC → correctCount DESC → totalTime ASC → earliestSubmit ASC
    leaderboardRaw.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      if (a.totalTime !== b.totalTime) return a.totalTime - b.totalTime;
      return a.earliestSubmit.getTime() - b.earliestSubmit.getTime();
    });

    // Get user names for top 50
    const topUsers = leaderboardRaw.slice(0, 50);
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
