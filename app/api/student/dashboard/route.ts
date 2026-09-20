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

    // Parse a stored lesson duration into seconds. Supports "109", "MM:SS",
    // "HH:MM:SS". Unset ("00:00"/"0"/"") → 0. (Same logic as the courses route.)
    const durToSeconds = (d: string | null | undefined): number => {
      if (!d) return 0;
      const s = String(d).trim();
      if (!s || s === "00:00" || s === "0") return 0;
      if (s.indexOf(":") === -1) {
        const n = parseInt(s, 10);
        return isNaN(n) ? 0 : n;
      }
      const parts = s.split(":").map((x) => parseInt(x, 10));
      if (parts.some((n) => isNaN(n))) return 0;
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0] || 0;
    };

    // Build enrolled courses with progress + REAL durations for accurate
    // remaining time = totalDurationSeconds - completedDurationSeconds.
    const enrolledCourses = enrollments.map((enrollment) => {
      const course = enrollment.course;
      const allLessons = course.modules.flatMap((m) => m.lessons);
      const totalLessons = allLessons.length;
      const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
      let totalDurationSeconds = 0;
      let completedDurationSeconds = 0;
      for (const l of allLessons) {
        const secs = durToSeconds(l.duration);
        totalDurationSeconds += secs;
        if (completedLessonIds.has(l.id)) completedDurationSeconds += secs;
      }
      return {
        id: course.id, title: course.title, color: course.color, icon: course.icon,
        totalLessons, completedLessons: completedCount,
        progressPercent: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
        totalDurationSeconds,
        completedDurationSeconds,
        remainingDurationSeconds: Math.max(0, totalDurationSeconds - completedDurationSeconds),
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
