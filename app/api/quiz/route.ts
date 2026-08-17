import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { recalculateAndAwardCoins } from "@/app/services/quiz-leaderboard.service";

/**
 * GET /api/quiz?lessonId=xxx
 * Get all quizzes for a lesson
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) return apiError(400, "lessonId is required.");

    const quizzes = await prisma.quiz.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
      select: { id: true, question: true, options: true, answer: true, explanation: true, order: true },
    });

    return apiSuccess({ quizzes });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST /api/quiz
 * Submit a quiz attempt
 * Body: { quizId, selected, courseId, lessonId?, timeTaken? }
 * 
 * Authorization: User must be enrolled in the course OR the lesson must be free.
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
    const { error, user } = requireAuth(req);
    if (error) {
      logger.warn("quiz-submit", "unauthorized_attempt", {});
      return error;
    }

    const { quizId, selected, courseId, lessonId, timeTaken } = await req.json();
    logger.info("quiz-submit", "request_received", { userId: user!.userId, quizId, courseId, lessonId });

    if (!quizId || selected === undefined || !courseId) {
      logger.warn("quiz-submit", "validation_failed", { userId: user!.userId, quizId, selected, courseId });
      return apiError(400, "quizId, selected, and courseId are required.");
    }

    // Get quiz to check answer (also fetch lesson for free-check)
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { lesson: { select: { isFree: true, module: { select: { courseId: true } } } } },
    });
    if (!quiz) return apiError(404, "Quiz not found.");

    // Verify enrollment: user must be enrolled in the course OR lesson must be free
    const isLessonFree = quiz.lesson?.isFree === true;
    if (!isLessonFree) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user!.userId, courseId } },
      });
      if (!enrollment) {
        logger.warn("quiz-submit", "enrollment_missing", { userId: user!.userId, courseId });
        return apiError(403, "Access denied. You are not enrolled in this course.");
      }
    }

    const correct = quiz.answer === Number(selected);

    // Save attempt with lessonId and timeTaken
    const effectiveLessonId = (lessonId && lessonId.trim()) ? lessonId.trim() : quiz.lessonId;
    
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user!.userId,
        quizId,
        courseId,
        lessonId: effectiveLessonId || null,
        selected: Number(selected),
        correct,
        timeTaken: timeTaken ? Number(timeTaken) : null,
      },
    });
    logger.success("quiz-submit", "attempt_saved", { userId: user!.userId, attemptId: attempt.id, correct, lessonId: effectiveLessonId });

    // After saving, recalculate lesson leaderboard and award coins
    let coinsAwarded = 0;
    let badge: string | null = null;
    let rank: number | null = null;

    if (effectiveLessonId) {
      const rankResult = await recalculateAndAwardCoins(user!.userId, effectiveLessonId, courseId);
      coinsAwarded = rankResult.coinsAwarded;
      badge = rankResult.badge;
      rank = rankResult.rank;
      if (coinsAwarded > 0) {
        logger.success("quiz-submit", "coins_awarded", { userId: user!.userId, coins: coinsAwarded, rank, badge, lessonId: effectiveLessonId });
      }
    }

    return apiSuccess({
      correct,
      correctAnswer: quiz.answer,
      explanation: quiz.explanation,
      attemptId: attempt.id,
      coinsAwarded,
      badge,
      rank,
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
