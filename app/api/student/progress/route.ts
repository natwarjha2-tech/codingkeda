import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { aggregateStudentProgress } from "@/app/services/student-progress.service";

/**
 * GET /api/student/progress
 * Returns comprehensive student progress data:
 * - Per-course: lessons attended, total lessons, quiz/exercise stats
 * - Per-module: lesson-wise breakdown
 * - Per-lesson: quiz accuracy, exercise passed, achievements, homework count
 * - Overall rating (out of 5) based on quiz scores + exercise completion
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const userId = user!.userId;

    // Get all enrollments with full course structure
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { order: "asc" },
              include: {
                lessons: {
                  orderBy: { order: "asc" },
                  select: { id: true, title: true, duration: true, order: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Collect all lesson IDs from enrolled courses
    const allLessonIds = enrollments.flatMap((e) =>
      e.course.modules.flatMap((m) => m.lessons.map((l) => l.id))
    );

    // Fetch all independent data in parallel (no dependencies between these queries)
    const [progress, quizAttempts, allQuizzes, exerciseSubmissions, allExercises, achievements, allHomeworks] = await Promise.all([
      prisma.progress.findMany({
        where: { userId },
        select: { lessonId: true, completed: true },
      }),
      prisma.quizAttempt.findMany({
        where: { userId },
        select: { lessonId: true, correct: true },
      }),
      prisma.quiz.findMany({
        where: { lessonId: { in: allLessonIds } },
        select: { id: true, lessonId: true },
      }),
      prisma.exerciseSubmission.findMany({
        where: { userId },
        select: { exerciseId: true, passed: true },
      }),
      prisma.exercise.findMany({
        where: { lessonId: { in: allLessonIds } },
        select: { id: true, lessonId: true },
      }),
      prisma.achievement.findMany({
        where: { userId },
        select: { lessonId: true, badgeType: true, title: true },
      }),
      prisma.homework.findMany({
        where: { lessonId: { in: allLessonIds } },
        select: { id: true, lessonId: true },
      }),
    ]);

    // Delegate aggregation to service layer (pure computation, no I/O)
    const result = aggregateStudentProgress(
      enrollments,
      progress,
      quizAttempts,
      allQuizzes,
      exerciseSubmissions,
      allExercises,
      achievements,
      allHomeworks,
    );

    return apiSuccess(result);
  } catch (err) {
    logger.error("student-progress", "unhandled_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
