import { prisma } from "@/app/lib/prisma";
import { notifyAchievement } from "@/app/lib/notification";

/**
 * Quiz Leaderboard Service
 * 
 * Encapsulates the business logic for:
 * - Calculating quiz rankings per lesson
 * - Awarding coins based on rank
 * - Preventing duplicate awards
 * - Creating achievements
 * 
 * Ranking criteria (in priority order):
 * 1. Score % (correct/total) DESC
 * 2. Correct count DESC
 * 3. Total time ASC (faster = better)
 * 4. Earliest submission ASC (first to achieve = better)
 * 
 * Coin rewards:
 * - Rank 1: 10 coins + "Super Master" badge
 * - Rank 2: 7 coins + "Master" badge
 * - Rank 3-10: 5 coins + "Pro" badge
 * - Rank 11+: No coins
 */

export interface LeaderboardResult {
  rank: number | null;
  coinsAwarded: number;
  badge: string | null;
}

/**
 * Recalculate lesson leaderboard and award coins if the user qualifies.
 * Safe to call multiple times — prevents duplicate coin awards.
 */
export async function recalculateAndAwardCoins(
  userId: string,
  lessonId: string,
  courseId: string
): Promise<LeaderboardResult> {
  try {
    // Get all attempts for this lesson (direct lessonId match)
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

    if (allAttempts.length === 0) return { rank: null, coinsAwarded: 0, badge: null };

    // Group by user — aggregate scores
    const userScores: Record<string, { total: number; correct: number; totalTime: number; earliestSubmit: Date }> = {};
    for (const a of allAttempts) {
      if (!userScores[a.userId]) {
        userScores[a.userId] = { total: 0, correct: 0, totalTime: 0, earliestSubmit: a.createdAt };
      }
      userScores[a.userId].total++;
      if (a.correct) userScores[a.userId].correct++;
      if (a.timeTaken) userScores[a.userId].totalTime += a.timeTaken;
      if (a.createdAt < userScores[a.userId].earliestSubmit) {
        userScores[a.userId].earliestSubmit = a.createdAt;
      }
    }

    // Rank: score DESC → correct DESC → time ASC → earlier ASC
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
      coins = 10; badgeType = "super-master"; badgeTitle = "Super Master";
    } else if (rank === 2) {
      coins = 7; badgeType = "master"; badgeTitle = "Master";
    } else if (rank >= 3 && rank <= 10) {
      coins = 5; badgeType = "pro"; badgeTitle = "Pro";
    }

    if (coins === 0) return { rank, coinsAwarded: 0, badge: null };

    // Check if already rewarded for this lesson (prevent duplicate awards)
    const existingTransaction = await prisma.coinTransaction.findFirst({
      where: { userId, lessonId, type: "EARNED" },
    });

    if (existingTransaction) {
      return { rank, coinsAwarded: 0, badge: badgeType };
    }

    // Award coins + achievement (atomic transaction)
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

    // Notification: achievement earned (non-blocking, idempotent)
    notifyAchievement({
      userId,
      title: badgeTitle!,
      badgeType: badgeType!,
      lessonId,
      courseId,
    }).catch(() => {});

    return { rank, coinsAwarded: coins, badge: badgeType };
  } catch {
    return { rank: null, coinsAwarded: 0, badge: null };
  }
}
