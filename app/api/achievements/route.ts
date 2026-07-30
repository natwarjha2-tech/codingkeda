import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/achievements
 * Get all achievements for the authenticated user with full details
 * Returns: certificate-style data with lesson, course, instructor info
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const achievements = await prisma.achievement.findMany({
      where: { userId: user!.userId },
      orderBy: { createdAt: "desc" },
    });

    if (achievements.length === 0) {
      return apiSuccess({ achievements: [], totalCount: 0 });
    }

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

    // Get quiz scores for each lesson achievement
    const quizScores: Record<string, number> = {};
    for (const lessonId of lessonIds) {
      const attempts = await prisma.quizAttempt.findMany({
        where: { userId: user!.userId, lessonId },
        select: { correct: true },
      });
      if (attempts.length > 0) {
        const correct = attempts.filter(a => a.correct).length;
        quizScores[lessonId] = Math.round((correct / attempts.length) * 100);
      }
    }

    // Build certificate-style achievement data
    const certificateData = achievements.map(a => {
      const lesson = lessonMap.get(a.lessonId);
      const course = lesson?.module?.course;
      const creator = course?.createdBy ? creatorMap.get(course.createdBy) : null;

      return {
        id: a.id,
        title: a.title,
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

    return apiSuccess({ achievements: certificateData, totalCount: certificateData.length });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
