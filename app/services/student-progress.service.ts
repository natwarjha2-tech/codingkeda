/**
 * Student Progress Aggregation Service
 * 
 * Pure computation layer — takes raw data from DB queries and builds
 * structured progress response with per-course/module/lesson breakdown.
 * 
 * Separated from the route handler for:
 * - Testability (pure function, no DB dependency)
 * - Reusability (can be called from cron jobs, reports, mobile API)
 * - Readability (route handles HTTP, service handles business logic)
 */

// ─── Input Types (raw data from DB) ───

export interface RawEnrollment {
  course: {
    id: string;
    title: string;
    category: string;
    color: string;
    icon: string;
    modules: {
      id: string;
      title: string;
      lessons: { id: string; title: string; duration: string; order: number }[];
    }[];
  };
}

export interface RawProgress { lessonId: string; completed: boolean }
export interface RawQuizAttempt { lessonId: string | null; correct: boolean }
export interface RawQuiz { id: string; lessonId: string }
export interface RawExerciseSubmission { exerciseId: string; passed: boolean }
export interface RawExercise { id: string; lessonId: string }
export interface RawAchievement { lessonId: string; badgeType: string; title: string }
export interface RawHomework { id: string; lessonId: string }

// ─── Output Types ───

export interface ProgressResult {
  overallRating: number;
  overallScore: number;
  ratingBreakdown: {
    quiz: { rating: number; accuracy: number; totalQuizzes: number; attempted: number; correct: number };
    exercise: { rating: number; passRate: number; totalExercises: number; attempted: number; passed: number };
  };
  totalLessonsCompleted: number;
  totalLessons: number;
  courses: CourseProgress[];
}

export interface CourseProgress {
  id: string;
  title: string;
  category: string;
  color: string;
  icon: string;
  totalLessons: number;
  lessonsCompleted: number;
  progressPercent: number;
  quiz: { total: number; attempted: number; correct: number; accuracy: number };
  exercise: { total: number; attempted: number; passed: number; rate: number };
  modules: { id: string; title: string; lessons: LessonProgress[] }[];
}

interface LessonProgress {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
  quiz: { total: number; attempted: number; correct: number; accuracy: number | null };
  exercise: { total: number; attempted: number; passed: number };
  achievements: { badgeType: string; title: string }[];
  homeworkCount: number;
}

// ─── Main Aggregation Function ───

/**
 * Aggregate student progress from raw DB data.
 * Pure function — no I/O, no side effects, fully testable.
 */
export function aggregateStudentProgress(
  enrollments: RawEnrollment[],
  progress: RawProgress[],
  quizAttempts: RawQuizAttempt[],
  allQuizzes: RawQuiz[],
  exerciseSubmissions: RawExerciseSubmission[],
  allExercises: RawExercise[],
  achievements: RawAchievement[],
  allHomeworks: RawHomework[],
): ProgressResult {
  const completedSet = new Set(
    progress.filter((p) => p.completed).map((p) => p.lessonId)
  );

  // ── Build aggregation maps ──

  // Quiz: group by lessonId
  const quizByLesson: Record<string, { total: number; attempted: number; correct: number }> = {};
  for (const q of allQuizzes) {
    if (!quizByLesson[q.lessonId]) quizByLesson[q.lessonId] = { total: 0, attempted: 0, correct: 0 };
    quizByLesson[q.lessonId].total++;
  }
  for (const a of quizAttempts) {
    const lid = a.lessonId || "";
    if (!lid) continue;
    if (!quizByLesson[lid]) quizByLesson[lid] = { total: 0, attempted: 0, correct: 0 };
    quizByLesson[lid].attempted++;
    if (a.correct) quizByLesson[lid].correct++;
  }

  // Exercise: group by lessonId
  const exerciseByLesson: Record<string, { total: number; attempted: number; passed: number }> = {};
  const exerciseIdToLesson: Record<string, string> = {};
  for (const ex of allExercises) {
    if (!exerciseByLesson[ex.lessonId]) exerciseByLesson[ex.lessonId] = { total: 0, attempted: 0, passed: 0 };
    exerciseByLesson[ex.lessonId].total++;
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
  const courses: CourseProgress[] = enrollments.map((enrollment) => {
    const course = enrollment.course;
    let courseQuizTotal = 0, courseQuizAttempted = 0, courseQuizCorrect = 0;
    let courseExTotal = 0, courseExAttempted = 0, courseExPassed = 0;
    let courseLessonsCompleted = 0;
    const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

    const modules = course.modules.map((mod) => {
      const lessons: LessonProgress[] = mod.lessons.map((lesson) => {
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
        const quizAccuracy = quiz.attempted > 0 ? Math.round((quiz.correct / quiz.attempted) * 100) : null;

        return {
          id: lesson.id,
          title: lesson.title,
          duration: lesson.duration,
          completed: isCompleted,
          quiz: { total: quiz.total, attempted: quiz.attempted, correct: quiz.correct, accuracy: quizAccuracy },
          exercise: { total: exercise.total, attempted: exercise.attempted, passed: exercise.passed },
          achievements: lessonAchievements,
          homeworkCount,
        };
      });

      return { id: mod.id, title: mod.title, lessons };
    });

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
      quiz: { total: courseQuizTotal, attempted: courseQuizAttempted, correct: courseQuizCorrect, accuracy: courseQuizAccuracy },
      exercise: { total: courseExTotal, attempted: courseExAttempted, passed: courseExPassed, rate: courseExerciseRate },
      modules,
    };
  });

  // ── Overall Rating ──
  const totalQuizAttempted = courses.reduce((s, c) => s + c.quiz.attempted, 0);
  const totalQuizCorrect = courses.reduce((s, c) => s + c.quiz.correct, 0);
  const totalExTotal = courses.reduce((s, c) => s + c.exercise.total, 0);
  const totalExPassed = courses.reduce((s, c) => s + c.exercise.passed, 0);

  const overallQuizAccuracy = totalQuizAttempted > 0 ? (totalQuizCorrect / totalQuizAttempted) * 100 : 0;
  const overallExerciseRate = totalExTotal > 0 ? (totalExPassed / totalExTotal) * 100 : 0;
  const overallScore = (overallQuizAccuracy * 0.7) + (overallExerciseRate * 0.3);

  return {
    overallRating: scoreToRating(overallScore),
    overallScore: Math.round(overallScore),
    ratingBreakdown: {
      quiz: {
        rating: scoreToRating(overallQuizAccuracy),
        accuracy: Math.round(overallQuizAccuracy),
        totalQuizzes: courses.reduce((s, c) => s + c.quiz.total, 0),
        attempted: totalQuizAttempted,
        correct: totalQuizCorrect,
      },
      exercise: {
        rating: scoreToRating(overallExerciseRate),
        passRate: Math.round(overallExerciseRate),
        totalExercises: totalExTotal,
        attempted: courses.reduce((s, c) => s + c.exercise.attempted, 0),
        passed: totalExPassed,
      },
    },
    totalLessonsCompleted: courses.reduce((s, c) => s + c.lessonsCompleted, 0),
    totalLessons: courses.reduce((s, c) => s + c.totalLessons, 0),
    courses,
  };
}

/** Convert a percentage score to a 1-5 star rating */
function scoreToRating(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}
