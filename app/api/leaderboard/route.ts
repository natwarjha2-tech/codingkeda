import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { extractUser } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/leaderboard?courseId=xxx&lessonId=yyy
 * Get leaderboard for a course or specific lesson based on quiz performance.
 * Auth optional (used to highlight current user rank).
 * 
 * Ranking: Score DESC → Correct COUNT DESC → Time ASC → Earlier submission ASC
 */
export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get("courseId");
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!courseId && !lessonId) return apiError(400, "courseId or lessonId is required.");

    const currentUser = extractUser(req);
    const currentUserId = currentUser?.userId || null;

    // Build query filter
    const whereClause: Record<string, string | undefined> = {};
    if (lessonId) whereClause.lessonId = lessonId;
    else if (courseId) whereClause.courseId = courseId;

    let allAttempts = await prisma.quizAttempt.findMany({
      where: whereClause,
      select: { userId: true, correct: true, createdAt: true, timeTaken: true },
    });

    // Fallback: if lessonId returns empty, try via Quiz→Lesson
    if (allAttempts.length === 0 && lessonId) {
      const quizIds = (await prisma.quiz.findMany({ where: { lessonId }, select: { id: true } })).map(q => q.id);
      if (quizIds.length > 0) {
        allAttempts = await prisma.quizAttempt.findMany({
          where: { quizId: { in: quizIds } },
          select: { userId: true, correct: true, createdAt: true, timeTaken: true },
        });
      }
    }

    if (allAttempts.length === 0) {
      return apiSuccess({ leaderboard: [], currentUserRank: null, totalStudents: 0 });
    }

    // Group by user
    const userScores: Record<string, { total: number; correct: number; earliestSubmit: Date; totalTime: number }> = {};
    allAttempts.forEach((a) => {
      if (!userScores[a.userId]) userScores[a.userId] = { total: 0, correct: 0, earliestSubmit: a.createdAt, totalTime: 0 };
      userScores[a.userId].total++;
      if (a.correct) userScores[a.userId].correct++;
      if (a.timeTaken) userScores[a.userId].totalTime += a.timeTaken;
      if (a.createdAt < userScores[a.userId].earliestSubmit) userScores[a.userId].earliestSubmit = a.createdAt;
    });

    // Rank: score DESC → correct DESC → time ASC → earlier ASC
    const ranked = Object.entries(userScores)
      .map(([userId, d]) => ({ userId, score: Math.round((d.correct / d.total) * 100), totalAttempts: d.total, correctCount: d.correct, totalTime: d.totalTime, earliestSubmit: d.earliestSubmit }))
      .sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.totalTime - b.totalTime || a.earliestSubmit.getTime() - b.earliestSubmit.getTime());

    // Get names for top 50
    const top50 = ranked.slice(0, 50);
    const users = await prisma.user.findMany({ where: { id: { in: top50.map(u => u.userId) } }, select: { id: true, name: true } });
    const nameMap = new Map(users.map(u => [u.id, u.name]));

    const leaderboard = top50.map((e, i) => ({
      rank: i + 1, name: nameMap.get(e.userId) || "Student", score: e.score,
      totalAttempts: e.totalAttempts, correctCount: e.correctCount, isCurrentUser: e.userId === currentUserId,
    }));

    // Current user rank
    let currentUserRank = null;
    if (currentUserId) {
      const idx = ranked.findIndex(e => e.userId === currentUserId);
      if (idx !== -1) currentUserRank = { rank: idx + 1, score: ranked[idx].score, totalStudents: ranked.length };
    }

    return apiSuccess({ leaderboard, currentUserRank, totalStudents: ranked.length });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
