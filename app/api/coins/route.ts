import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/coins
 * Get user's total coins + recent transactions
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    // Get or create UserCoins record
    let userCoins = await prisma.userCoins.findUnique({
      where: { userId: user!.userId },
    });

    if (!userCoins) {
      userCoins = await prisma.userCoins.create({
        data: { userId: user!.userId, totalCoins: 0 },
      });
    }

    // Get recent transactions (last 20)
    const rawTransactions = await prisma.coinTransaction.findMany({
      where: { userId: user!.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, coins: true, reason: true, createdAt: true, lessonId: true, courseId: true },
    });

    // Resolve Course → Module → Lesson names for transactions that carry a
    // lessonId/courseId (e.g. quiz rank rewards), so the client can show a clear
    // hierarchy of where each coin came from. Transactions without these ids
    // (referral, coupon, coding) simply keep their reason string. One batch query.
    const txLessonIds = Array.from(
      new Set(rawTransactions.map((t) => t.lessonId).filter((v): v is string => !!v))
    );
    const txCourseIds = Array.from(
      new Set(rawTransactions.map((t) => t.courseId).filter((v): v is string => !!v))
    );

    const [lessonRows, courseRows] = await Promise.all([
      txLessonIds.length
        ? prisma.lesson.findMany({
            where: { id: { in: txLessonIds } },
            select: { id: true, title: true, module: { select: { title: true, courseId: true } } },
          })
        : Promise.resolve([]),
      txCourseIds.length
        ? prisma.course.findMany({
            where: { id: { in: txCourseIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

    const lessonMap = new Map(lessonRows.map((l) => [l.id, l]));
    const courseMap = new Map(courseRows.map((c) => [c.id, c.title]));

    const transactions = rawTransactions.map((t) => {
      const lesson = t.lessonId ? lessonMap.get(t.lessonId) : null;
      // Course title: prefer the transaction's courseId, else the lesson's module course.
      const courseTitle =
        (t.courseId && courseMap.get(t.courseId)) ||
        (lesson?.module?.courseId && courseMap.get(lesson.module.courseId)) ||
        null;
      return {
        id: t.id,
        type: t.type,
        coins: t.coins,
        reason: t.reason,
        createdAt: t.createdAt,
        courseTitle,
        moduleTitle: lesson?.module?.title || null,
        lessonTitle: lesson?.title || null,
      };
    });

    // Get achievements
    const achievements = await prisma.achievement.findMany({
      where: { userId: user!.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, badgeType: true, lessonId: true, createdAt: true },
    });

    return apiSuccess({ totalCoins: userCoins.totalCoins, transactions, achievements });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
