import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/student/dashboard
 * Returns enrolled courses with progress + completed videos count + last watched lesson
 * Requires valid user token
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    // Get all enrollments with course + modules + lessons
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: payload.userId },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { order: "asc" },
              include: {
                lessons: {
                  orderBy: { order: "asc" },
                  select: { id: true, title: true, duration: true, order: true, videoUrl: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all completed lessons for this user
    const completedProgress = await prisma.progress.findMany({
      where: { userId: payload.userId, completed: true },
      select: { lessonId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));
    const totalCompletedVideos = completedProgress.length;

    // Build enrolled courses with progress
    const enrolledCourses = enrollments.map((enrollment) => {
      const course = enrollment.course;
      const allLessons = course.modules.flatMap((m) => m.lessons);
      const totalLessons = allLessons.length;
      const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
      const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      return {
        id: course.id,
        title: course.title,
        color: course.color,
        icon: course.icon,
        totalLessons,
        completedLessons: completedCount,
        progressPercent,
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
            lastWatched = {
              courseId: enrollment.course.id,
              courseTitle: enrollment.course.title,
              moduleId: mod.id,
              moduleTitle: mod.title,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              videoUrl: lesson.videoUrl,
              progressPercent: enrolledCourses.find((c) => c.id === enrollment.course.id)?.progressPercent || 0,
            };
            break;
          }
        }
        if (lastWatched) break;
      }
    }

    return NextResponse.json({
      success: true,
      enrolledCount: enrollments.length,
      completedVideos: totalCompletedVideos,
      enrolledCourses,
      lastWatched,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
