import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

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
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

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

    // Get all user progress (completed lessons)
    const progress = await prisma.progress.findMany({
      where: { userId },
      select: { lessonId: true, completed: true, updatedAt: true },
    });
    const completedSet = new Set(
      progress.filter((p) => p.completed).map((p) => p.lessonId)
    );

    // Get all quiz attempts for this user
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId },
      select: { lessonId: true, correct: true, quizId: true, courseId: true },
    });

    // Get all quizzes (to know total per lesson)
    const allLessonIds = enrollments.flatMap((e) =>
      e.course.modules.flatMap((m) => m.lessons.map((l) => l.id))
    );
    const allQuizzes = await prisma.quiz.findMany({
      where: { lessonId: { in: allLessonIds } },
      select: { id: true, lessonId: true },
    });

    // Get exercise submissions
    const exerciseSubmissions = await prisma.exerciseSubmission.findMany({
      where: { userId },
      select: { exerciseId: true, passed: true, courseId: true },
    });

    // Get all exercises (to know total per lesson)
    const allExercises = await prisma.exercise.findMany({
      where: { lessonId: { in: allLessonIds } },
      select: { id: true, lessonId: true },
    });

    // Get achievements
    const achievements = await prisma.achievement.findMany({
      where: { userId },
      select: { lessonId: true, badgeType: true, title: true },
    });

    // Get homework count per lesson
    const allHomeworks = await prisma.homework.findMany({
      where: { lessonId: { in: allLessonIds } },
      select: { id: true, lessonId: true },
    });

    // ── Build aggregation maps ──

    // Quiz: group by lessonId
    const quizByLesson: Record<string, { total: number; attempted: number; correct: number }> = {};
    // Count total quizzes per lesson
    for (const q of allQuizzes) {
      if (!quizByLesson[q.lessonId]) quizByLesson[q.lessonId] = { total: 0, attempted: 0, correct: 0 };
      quizByLesson[q.lessonId].total++;
    }
    // Count attempted + correct
    for (const a of quizAttempts) {
      const lid = a.lessonId || "";
      if (!lid) continue;
      if (!quizByLesson[lid]) quizByLesson[lid] = { total: 0, attempted: 0, correct: 0 };
      quizByLesson[lid].attempted++;
      if (a.correct) quizByLesson[lid].correct++;
    }

    // Exercise: group by lessonId
    const exerciseByLesson: Record<string, { total: number; attempted: number; passed: number }> = {};
    for (const ex of allExercises) {
      if (!exerciseByLesson[ex.lessonId]) exerciseByLesson[ex.lessonId] = { total: 0, attempted: 0, passed: 0 };
      exerciseByLesson[ex.lessonId].total++;
    }
    const exerciseIdToLesson: Record<string, string> = {};
    for (const ex of allExercises) {
      exerciseIdToLesson[ex.id] = ex.lessonId;
    }
    for (const sub of exerciseSubmissions) {
      const lid = exerciseIdToLesson[sub.exerciseId];
      if (!lid) continue;
      if (!exerciseByLesson[lid]) exerciseByLesson[lid] = { total: 0, attempted: 0, passed: 0 };
      exerciseByLesson[lid].attempted++;
      if (sub.passed) exerciseByLesson[lid].passed++;
    }

    // Achievements: group by lessonId
    const achievementsByLesson: Record<string, { badgeType: string; title: string }[]> = {};
    for (const a of achievements) {
      if (!achievementsByLesson[a.lessonId]) achievementsByLesson[a.lessonId] = [];
      achievementsByLesson[a.lessonId].push({ badgeType: a.badgeType, title: a.title });
    }

    // Homework: count per lesson
    const homeworkByLesson: Record<string, number> = {};
    for (const hw of allHomeworks) {
      homeworkByLesson[hw.lessonId] = (homeworkByLesson[hw.lessonId] || 0) + 1;
    }

    // ── Build per-course response ──
    const courses = enrollments.map((enrollment) => {
      const course = enrollment.course;
      let courseQuizTotal = 0, courseQuizAttempted = 0, courseQuizCorrect = 0;
      let courseExTotal = 0, courseExAttempted = 0, courseExPassed = 0;
      let courseLessonsCompleted = 0;
      const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

      const modules = course.modules.map((mod) => {
        const lessons = mod.lessons.map((lesson) => {
          const isCompleted = completedSet.has(lesson.id);
          if (isCompleted) courseLessonsCompleted++;

          const quiz = quizByLesson[lesson.id] || { total: 0, attempted: 0, correct: 0 };
          courseQuizTotal += quiz.total;
          courseQuizAttempted += quiz.attempted;
          courseQuizCorrect += quiz.correct;

          const exercise = exerciseByLesson[lesson.id] || { total: 0, attempted: 0, passed: 0 };
          courseExTotal += exercise.total;
          courseExAttempted += exercise.attempted;
          courseExPassed += exercise.passed;

          const lessonAchievements = achievementsByLesson[lesson.id] || [];
          const homeworkCount = homeworkByLesson[lesson.id] || 0;

          // Per-lesson quiz accuracy
          const quizAccuracy = quiz.attempted > 0 ? Math.round((quiz.correct / quiz.attempted) * 100) : null;

          return {
            id: lesson.id,
            title: lesson.title,
            duration: lesson.duration,
            completed: isCompleted,
            quiz: {
              total: quiz.total,
              attempted: quiz.attempted,
              correct: quiz.correct,
              accuracy: quizAccuracy,
            },
            exercise: {
              total: exercise.total,
              attempted: exercise.attempted,
              passed: exercise.passed,
            },
            achievements: lessonAchievements,
            homeworkCount,
          };
        });

        return {
          id: mod.id,
          title: mod.title,
          lessons,
        };
      });

      // Course-level quiz accuracy
      const courseQuizAccuracy = courseQuizAttempted > 0 ? Math.round((courseQuizCorrect / courseQuizAttempted) * 100) : 0;
      const courseExerciseRate = courseExTotal > 0 ? Math.round((courseExPassed / courseExTotal) * 100) : 0;

      return {
        id: course.id,
        title: course.title,
        category: course.category,
        color: course.color,
        icon: course.icon,
        totalLessons,
        lessonsCompleted: courseLessonsCompleted,
        progressPercent: totalLessons > 0 ? Math.round((courseLessonsCompleted / totalLessons) * 100) : 0,
        quiz: {
          total: courseQuizTotal,
          attempted: courseQuizAttempted,
          correct: courseQuizCorrect,
          accuracy: courseQuizAccuracy,
        },
        exercise: {
          total: courseExTotal,
          attempted: courseExAttempted,
          passed: courseExPassed,
          rate: courseExerciseRate,
        },
        modules,
      };
    });

    // ── Overall Rating (out of 5) ──
    // Rating formula: 70% quiz accuracy + 30% exercise pass rate
    // >90% = 5 stars, >75% = 4 stars, >60% = 3 stars, >40% = 2 stars, else 1 star
    const totalQuizAttempted = courses.reduce((s, c) => s + c.quiz.attempted, 0);
    const totalQuizCorrect = courses.reduce((s, c) => s + c.quiz.correct, 0);
    const totalExTotal = courses.reduce((s, c) => s + c.exercise.total, 0);
    const totalExPassed = courses.reduce((s, c) => s + c.exercise.passed, 0);

    const overallQuizAccuracy = totalQuizAttempted > 0 ? (totalQuizCorrect / totalQuizAttempted) * 100 : 0;
    const overallExerciseRate = totalExTotal > 0 ? (totalExPassed / totalExTotal) * 100 : 0;
    const overallScore = (overallQuizAccuracy * 0.7) + (overallExerciseRate * 0.3);

    let overallRating = 1;
    if (overallScore >= 90) overallRating = 5;
    else if (overallScore >= 75) overallRating = 4;
    else if (overallScore >= 60) overallRating = 3;
    else if (overallScore >= 40) overallRating = 2;

    // Quiz-only rating
    let quizRating = 1;
    if (overallQuizAccuracy >= 90) quizRating = 5;
    else if (overallQuizAccuracy >= 75) quizRating = 4;
    else if (overallQuizAccuracy >= 60) quizRating = 3;
    else if (overallQuizAccuracy >= 40) quizRating = 2;

    // Exercise-only rating
    let exerciseRating = 1;
    if (overallExerciseRate >= 90) exerciseRating = 5;
    else if (overallExerciseRate >= 75) exerciseRating = 4;
    else if (overallExerciseRate >= 60) exerciseRating = 3;
    else if (overallExerciseRate >= 40) exerciseRating = 2;

    return NextResponse.json({
      success: true,
      overallRating,
      overallScore: Math.round(overallScore),
      ratingBreakdown: {
        quiz: {
          rating: quizRating,
          accuracy: Math.round(overallQuizAccuracy),
          totalQuizzes: courses.reduce((s, c) => s + c.quiz.total, 0),
          attempted: totalQuizAttempted,
          correct: totalQuizCorrect,
        },
        exercise: {
          rating: exerciseRating,
          passRate: Math.round(overallExerciseRate),
          totalExercises: totalExTotal,
          attempted: courses.reduce((s, c) => s + c.exercise.attempted, 0),
          passed: totalExPassed,
        },
      },
      totalLessonsCompleted: courses.reduce((s, c) => s + c.lessonsCompleted, 0),
      totalLessons: courses.reduce((s, c) => s + c.totalLessons, 0),
      courses,
    });
  } catch (err) {
    console.error("Student progress error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
