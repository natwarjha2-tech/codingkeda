import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";

/**
 * GET /api/quiz?lessonId=xxx
 * Get all quizzes for a lesson
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");

    if (!lessonId) {
      return NextResponse.json(
        { success: false, message: "lessonId is required." },
        { status: 400 }
      );
    }

    const quizzes = await prisma.quiz.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        question: true,
        options: true,
        answer: true,
        explanation: true,
        order: true,
      },
    });

    return NextResponse.json({ success: true, quizzes });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quiz
 * Submit a quiz attempt
 * Body: { quizId, selected, courseId, lessonId?, timeTaken? }
 * 
 * After saving attempt, recalculates lesson leaderboard and awards coins:
 * - Rank 1: Super Master + 10 coins
 * - Rank 2: Master + 7 coins
 * - Rank 3-10: Pro + 5 coins
 * 
 * Duplicate coin prevention: checks CoinTransaction before awarding
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      logger.warn("quiz-submit", "unauthorized_attempt", {});
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const { quizId, selected, courseId, lessonId, timeTaken } = await req.json();
    logger.info("quiz-submit", "request_received", { userId: payload.userId, quizId, courseId, lessonId });

    if (!quizId || selected === undefined || !courseId) {
      logger.warn("quiz-submit", "validation_failed", { userId: payload.userId, quizId, selected, courseId });
      return NextResponse.json(
        { success: false, message: "quizId, selected, and courseId are required." },
        { status: 400 }
      );
    }

    // Get quiz to check answer
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found." },
        { status: 404 }
      );
    }

    const correct = quiz.answer === Number(selected);

    // Save attempt with lessonId and timeTaken
    const effectiveLessonId = (lessonId && lessonId.trim()) ? lessonId.trim() : quiz.lessonId;
    
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: payload.userId,
        quizId,
        courseId,
        lessonId: effectiveLessonId || null,
        selected: Number(selected),
        correct,
        timeTaken: timeTaken ? Number(timeTaken) : null,
      },
    });
    logger.success("quiz-submit", "attempt_saved", { userId: payload.userId, attemptId: attempt.id, correct, lessonId: effectiveLessonId });

    // After saving, recalculate lesson leaderboard and award coins
    let coinsAwarded = 0;
    let badge: string | null = null;
    let rank: number | null = null;

    if (effectiveLessonId) {
      const rankResult = await _recalculateAndAwardCoins(payload.userId, effectiveLessonId, courseId);
      coinsAwarded = rankResult.coinsAwarded;
      badge = rankResult.badge;
      rank = rankResult.rank;
      if (coinsAwarded > 0) {
        logger.success("quiz-submit", "coins_awarded", { userId: payload.userId, coins: coinsAwarded, rank, badge, lessonId: effectiveLessonId });
      }
    }

    return NextResponse.json({
      success: true,
      correct,
      correctAnswer: quiz.answer,
      explanation: quiz.explanation,
      attemptId: attempt.id,
      coinsAwarded,
      badge,
      rank,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * Recalculate lesson leaderboard and award coins if rank improved
 * Returns: { rank, coinsAwarded, badge }
 */
async function _recalculateAndAwardCoins(
  userId: string,
  lessonId: string,
  courseId: string
): Promise<{ rank: number | null; coinsAwarded: number; badge: string | null }> {
  try {
    // Get all attempts for this lesson (direct match or via Quiz relationship)
    let allAttempts = await prisma.quizAttempt.findMany({
      where: { lessonId },
      select: { userId: true, correct: true, createdAt: true, timeTaken: true },
    });

    // Fallback: if direct lessonId match returns empty, find via Quiz→Lesson
    if (allAttempts.length === 0) {
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

    // Group by user
    const userScores: Record<string, { total: number; correct: number; totalTime: number; earliestSubmit: Date }> = {};
    allAttempts.forEach((a) => {
      if (!userScores[a.userId]) {
        userScores[a.userId] = { total: 0, correct: 0, totalTime: 0, earliestSubmit: a.createdAt };
      }
      userScores[a.userId].total++;
      if (a.correct) userScores[a.userId].correct++;
      if (a.timeTaken) userScores[a.userId].totalTime += a.timeTaken;
      if (a.createdAt < userScores[a.userId].earliestSubmit) {
        userScores[a.userId].earliestSubmit = a.createdAt;
      }
    });

    // Sort: score DESC → correct DESC → time ASC → earlier ASC
    const ranked = Object.entries(userScores)
      .map(([uid, data]) => ({
        userId: uid,
        score: Math.round((data.correct / data.total) * 100),
        correctCount: data.correct,
        totalTime: data.totalTime,
        earliestSubmit: data.earliestSubmit,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
        if (a.totalTime !== b.totalTime) return a.totalTime - b.totalTime;
        return a.earliestSubmit.getTime() - b.earliestSubmit.getTime();
      });

    // Find user's rank
    const userIndex = ranked.findIndex((e) => e.userId === userId);
    if (userIndex === -1) return { rank: null, coinsAwarded: 0, badge: null };

    const rank = userIndex + 1;

    // Determine coins and badge based on rank
    let coins = 0;
    let badgeType: string | null = null;
    let badgeTitle: string | null = null;

    if (rank === 1) {
      coins = 10;
      badgeType = "super-master";
      badgeTitle = "Super Master";
    } else if (rank === 2) {
      coins = 7;
      badgeType = "master";
      badgeTitle = "Master";
    } else if (rank >= 3 && rank <= 10) {
      coins = 5;
      badgeType = "pro";
      badgeTitle = "Pro";
    }

    if (coins === 0) return { rank, coinsAwarded: 0, badge: null };

    // Check if already rewarded for this lesson at this rank or better
    const existingTransaction = await prisma.coinTransaction.findFirst({
      where: {
        userId,
        lessonId,
        type: "EARNED",
      },
    });

    if (existingTransaction) {
      // Already rewarded for this lesson — no duplicate coins
      return { rank, coinsAwarded: 0, badge: badgeType };
    }

    // Award coins (atomic transaction)
    await prisma.$transaction([
      prisma.userCoins.upsert({
        where: { userId },
        update: { totalCoins: { increment: coins } },
        create: { userId, totalCoins: coins },
      }),
      prisma.coinTransaction.create({
        data: {
          userId,
          type: "EARNED",
          coins,
          reason: `Quiz Rank #${rank} - Lesson reward`,
          lessonId,
          courseId,
        },
      }),
      prisma.achievement.upsert({
        where: { userId_lessonId_badgeType: { userId, lessonId, badgeType: badgeType! } },
        update: {},
        create: {
          userId,
          title: badgeTitle!,
          badgeType: badgeType!,
          lessonId,
          courseId,
        },
      }),
    ]);

    return { rank, coinsAwarded: coins, badge: badgeType };
  } catch {
    return { rank: null, coinsAwarded: 0, badge: null };
  }
}
