import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { medalLabel } from "@/app/lib/medals";
import { getCodingMedals } from "@/app/services/coding-medals.service";

/**
 * GET /api/achievements
 * Get achievements for the authenticated user with full details.
 * Returns: certificate-style data with lesson, course, instructor info.
 * 
 * Pagination (optional, backward-compatible):
 *   ?page=1&limit=20 → paginated response
 *   No params → returns all achievements (legacy behavior)
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    // Parse optional pagination params
    const pageParam = req.nextUrl.searchParams.get("page");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : null;
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : null;
    const isPaginated = page !== null && limit !== null;

    // Get total count for pagination metadata
    const totalCount = await prisma.achievement.count({
      where: { userId: user!.userId },
    });

    // Opt-in (?include=coding, used by the mobile app): also list coding and
    // weekly-challenge medals. Off by default so the desktop app is unchanged.
    const includeCoding = req.nextUrl.searchParams.get("include") === "coding" && !isPaginated;
    const codingItems = includeCoding
      ? (await getCodingMedals(user!.userId)).badges.map((b, i) => ({
          id: `coding-${i}-${b.earnedAt}`,
          title: `${b.label}`,
          badgeType: b.key,
          lessonTitle: b.title,
          moduleTitle: "",
          courseTitle: b.kind === "weekly" ? "Weekly Challenge" : "Coding Exercise",
          instructor: "CodingKida Team",
          institute: "",
          adminName: "CodingKida",
          studentName: "",
          rank: b.rank,
          coins: b.coins,
          earnedAt: b.earnedAt,
          founderName: "CodingKida Team",
        }))
      : [];

    if (totalCount === 0) {
      return apiSuccess({
        achievements: codingItems,
        totalCount: codingItems.length,
        ...(isPaginated && { page, limit, totalPages: 0 }),
      });
    }

    // Fetch achievements with optional pagination
    const achievements = await prisma.achievement.findMany({
      where: { userId: user!.userId },
      orderBy: { createdAt: "desc" },
      ...(isPaginated && { skip: (page - 1) * limit, take: limit }),
    });

    // Get lesson details for each achievement
    const lessonIds = [...new Set(achievements.map(a => a.lessonId))];
    const lessons = await prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: {
        id: true,
        title: true,
        module: {
          select: {
            title: true,
            course: {
              select: {
                id: true,
                title: true,
                instructor: true,
                institute: true,
                createdBy: true,
              },
            },
          },
        },
      },
    });

    const lessonMap = new Map(lessons.map(l => [l.id, l]));

    // Get admin/creator details
    const creatorIds = [...new Set(lessons.map(l => l.module.course.createdBy).filter(Boolean))] as string[];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, email: true },
    });
    const creatorMap = new Map(creators.map(u => [u.id, u]));

    // Get student name
    const student = await prisma.user.findUnique({
      where: { id: user!.userId },
      select: { name: true, email: true },
    });

    // Get quiz scores for all lesson achievements in a single query (no N+1)
    const allAttempts = await prisma.quizAttempt.findMany({
      where: { userId: user!.userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, correct: true },
    });

    // Group by lessonId and calculate scores in-memory
    const quizScores: Record<string, number> = {};
    const attemptsByLesson: Record<string, { total: number; correct: number }> = {};
    for (const attempt of allAttempts) {
      if (!attempt.lessonId) continue;
      if (!attemptsByLesson[attempt.lessonId]) {
        attemptsByLesson[attempt.lessonId] = { total: 0, correct: 0 };
      }
      attemptsByLesson[attempt.lessonId].total++;
      if (attempt.correct) attemptsByLesson[attempt.lessonId].correct++;
    }
    for (const [lessonId, data] of Object.entries(attemptsByLesson)) {
      quizScores[lessonId] = Math.round((data.correct / data.total) * 100);
    }

    // Build certificate-style achievement data
    const certificateData = achievements.map(a => {
      const lesson = lessonMap.get(a.lessonId);
      const course = lesson?.module?.course;
      const creator = course?.createdBy ? creatorMap.get(course.createdBy) : null;

      return {
        id: a.id,
        // New medal names (Quiz Gold / Silver / Bronze), also for badges saved with the old names.
        title: medalLabel(a.badgeType) !== a.badgeType ? medalLabel(a.badgeType) : a.title,
        badgeType: a.badgeType,
        lessonTitle: lesson?.title || "Unknown Lesson",
        moduleTitle: lesson?.module?.title || "",
        courseTitle: course?.title || "Unknown Course",
        instructor: course?.instructor || "CodingKida Team",
        institute: course?.institute || "",
        adminName: creator?.name || course?.instructor || "CodingKida",
        studentName: student?.name || "Student",
        score: quizScores[a.lessonId] || 0,
        rank: a.badgeType === "super-master" ? 1 : a.badgeType === "master" ? 2 : 3,
        earnedAt: a.createdAt,
        founderName: "CodingKida Team",
      };
    });

    const allItems = codingItems.length
      ? [...certificateData, ...codingItems].sort(
          (a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime()
        )
      : certificateData;

    return apiSuccess({
      achievements: allItems,
      totalCount: totalCount + codingItems.length,
      ...(isPaginated && { page, limit, totalPages: Math.ceil(totalCount / limit) }),
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
