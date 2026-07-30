import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * GET /api/student/dashboard
 * Returns enrolled courses with progress + completed videos count + last watched lesson
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const signed = new URL(req.url).searchParams.get("signed") === "true";

    // Get all enrollments with course + modules + lessons
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: user!.userId },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { order: "asc" },
              include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, duration: true, order: true, videoUrl: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all completed lessons for this user
    const completedProgress = await prisma.progress.findMany({
      where: { userId: user!.userId, completed: true },
      select: { lessonId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));

    // Build enrolled courses with progress
    const enrolledCourses = enrollments.map((enrollment) => {
      const course = enrollment.course;
      const allLessons = course.modules.flatMap((m) => m.lessons);
      const totalLessons = allLessons.length;
      const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
      return {
        id: course.id, title: course.title, color: course.color, icon: course.icon,
        totalLessons, completedLessons: completedCount,
        progressPercent: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
      };
    });

    // Find last watched lesson
    let lastWatched = null;
    if (completedProgress.length > 0) {
      const lastLessonId = completedProgress[0].lessonId;
      for (const enrollment of enrollments) {
        for (const mod of enrollment.course.modules) {
          const lesson = mod.lessons.find((l) => l.id === lastLessonId);
          if (lesson) {
            let videoUrl = lesson.videoUrl;
            if (signed && getS3KeyFromUrl(videoUrl)) videoUrl = await getSignedFileUrlFromUrl(videoUrl);
            lastWatched = {
              courseId: enrollment.course.id, courseTitle: enrollment.course.title,
              moduleId: mod.id, moduleTitle: mod.title,
              lessonId: lesson.id, lessonTitle: lesson.title, videoUrl,
              progressPercent: enrolledCourses.find((c) => c.id === enrollment.course.id)?.progressPercent || 0,
            };
            break;
          }
        }
        if (lastWatched) break;
      }
    }

    return apiSuccess({ enrolledCount: enrollments.length, completedVideos: completedProgress.length, enrolledCourses, lastWatched });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
