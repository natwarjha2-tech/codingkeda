import { prisma } from "@/app/lib/prisma";
import { activeEnrollment } from "@/app/lib/access";
import { aggregateStudentProgress } from "@/app/services/student-progress.service";
import { rankLessonQuiz } from "@/app/services/quiz-leaderboard.service";
import { realUsersOr } from "@/app/lib/guest";

/**
 * Leaderboards.
 *
 *  - Course board: every student enrolled in the course, ranked by the same
 *    "learning score" shown in Student Progress (quiz accuracy 50% + exercise
 *    pass rate 50%). Students who have not started yet are listed last.
 *  - Lesson boards: one for the quiz and one for the coding exercises of a
 *    single lesson. Anyone who attempted it is listed.
 */

export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
  isCurrentUser: boolean;
  [extra: string]: unknown;
}
export interface Board {
  leaderboard: BoardEntry[];
  currentUserRank: { rank: number; score: number; totalStudents: number } | null;
  totalStudents: number;
}

const TOP = 50;

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name || "Student"]));
}

function finish<T extends { userId: string; score: number }>(
  ranked: T[],
  currentUserId: string | null,
  names: Map<string, string>,
  extra: (e: T) => Record<string, unknown>,
): Board {
  const leaderboard: BoardEntry[] = ranked.slice(0, TOP).map((e, i) => ({
    rank: i + 1,
    name: names.get(e.userId) || "Student",
    score: e.score,
    isCurrentUser: e.userId === currentUserId,
    ...extra(e),
  }));
  let currentUserRank: Board["currentUserRank"] = null;
  if (currentUserId) {
    const idx = ranked.findIndex((e) => e.userId === currentUserId);
    if (idx !== -1) currentUserRank = { rank: idx + 1, score: ranked[idx].score, totalStudents: ranked.length };
  }
  return { leaderboard, currentUserRank, totalStudents: ranked.length };
}

// ── Course board (learning score) ──────────────────────────────────────────

interface CourseRow {
  userId: string;
  score: number;
  quizAccuracy: number;
  exerciseRate: number;
  progressPercent: number;
  lessonsCompleted: number;
  totalLessons: number;
  quizAttempted: number;
  quizCorrect: number;
}
const courseCache = new Map<string, { at: number; rows: CourseRow[] }>();
const COURSE_TTL_MS = 30_000;

async function computeCourseRows(courseId: string): Promise<CourseRow[]> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, duration: true, order: true } },
        },
      },
    },
  });
  if (!course) return [];

  const enrolled = await prisma.enrollment.findMany({
    where: { courseId, ...activeEnrollment() },
    select: { userId: true },
  });
  const userIds = enrolled.map((e) => e.userId);
  if (userIds.length === 0) return [];

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const [allQuizzes, allExercises] = await Promise.all([
    prisma.quiz.findMany({ where: { lessonId: { in: lessonIds } }, select: { id: true, lessonId: true } }),
    prisma.exercise.findMany({ where: { lessonId: { in: lessonIds } }, select: { id: true, lessonId: true } }),
  ]);
  const [progress, attempts, subs] = await Promise.all([
    prisma.progress.findMany({
      where: { userId: { in: userIds }, lessonId: { in: lessonIds }, completed: true },
      select: { userId: true, lessonId: true, completed: true },
    }),
    prisma.quizAttempt.findMany({
      where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
      select: { userId: true, lessonId: true, quizId: true, correct: true },
    }),
    prisma.exerciseSubmission.findMany({
      where: { userId: { in: userIds }, exerciseId: { in: allExercises.map((e) => e.id) } },
      select: { userId: true, exerciseId: true, passed: true },
    }),
  ]);

  const group = <T extends { userId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const list = m.get(r.userId);
      if (list) list.push(r); else m.set(r.userId, [r]);
    }
    return m;
  };
  const pBy = group(progress), aBy = group(attempts), sBy = group(subs);
  const enrollment = {
    course: {
      id: course.id, title: course.title, category: course.category, color: course.color, icon: course.icon,
      modules: course.modules.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons })),
    },
  };

  return userIds.map((userId) => {
    const r = aggregateStudentProgress(
      [enrollment],
      pBy.get(userId) ?? [],
      aBy.get(userId) ?? [],
      allQuizzes,
      sBy.get(userId) ?? [],
      allExercises,
      [],
      [],
    );
    const c = r.courses[0];
    return {
      userId,
      score: r.overallScore,
      quizAccuracy: c.quiz.accuracy,
      exerciseRate: c.exercise.rate,
      progressPercent: c.progressPercent,
      lessonsCompleted: c.lessonsCompleted,
      totalLessons: c.totalLessons,
      quizAttempted: c.quiz.attempted,
      quizCorrect: c.quiz.correct,
    };
  });
}

export async function courseLeaderboard(courseId: string, currentUserId: string | null): Promise<Board> {
  let hit = courseCache.get(courseId);
  if (!hit || Date.now() - hit.at > COURSE_TTL_MS) {
    const rows = (await computeCourseRows(courseId)).sort(
      (a, b) =>
        b.score - a.score ||
        b.lessonsCompleted - a.lessonsCompleted ||
        b.quizCorrect - a.quizCorrect,
    );
    hit = { at: Date.now(), rows };
    courseCache.set(courseId, hit);
  }
  const ranked = hit.rows;
  const names = await namesFor(ranked.slice(0, TOP).map((e) => e.userId));
  return finish(ranked, currentUserId, names, (e) => ({
    quizAccuracy: e.quizAccuracy,
    exerciseRate: e.exerciseRate,
    progressPercent: e.progressPercent,
    lessonsCompleted: e.lessonsCompleted,
    totalLessons: e.totalLessons,
    // kept for older app versions that read these
    totalAttempts: e.quizAttempted,
    correctCount: e.quizCorrect,
  }));
}

// ── Lesson boards ──────────────────────────────────────────────────────────

export async function lessonQuizLeaderboard(lessonId: string, currentUserId: string | null): Promise<Board & { totalQuestions: number }> {
  const { ranked, questionCount } = await rankLessonQuiz(lessonId, currentUserId);
  const names = await namesFor(ranked.slice(0, TOP).map((e) => e.userId));
  const board = finish(ranked, currentUserId, names, (e) => ({
    correctCount: e.correctCount,
    totalQuestions: questionCount,
    timeSeconds: e.totalTime,
  }));
  return { ...board, totalQuestions: questionCount };
}

export async function lessonExerciseLeaderboard(lessonId: string, currentUserId: string | null): Promise<Board & { totalExercises: number }> {
  const exercises = await prisma.exercise.findMany({ where: { lessonId, type: "coding" }, select: { id: true } });
  const total = exercises.length;
  if (total === 0) return { leaderboard: [], currentUserRank: null, totalStudents: 0, totalExercises: 0 };

  const subs = await prisma.exerciseSubmission.findMany({
    where: { exerciseId: { in: exercises.map((e) => e.id) }, ...realUsersOr(currentUserId) },
    select: { userId: true, exerciseId: true, passed: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const per = new Map<string, { attempted: Set<string>; firstPass: Map<string, number> }>();
  for (const s of subs) {
    let u = per.get(s.userId);
    if (!u) { u = { attempted: new Set(), firstPass: new Map() }; per.set(s.userId, u); }
    u.attempted.add(s.exerciseId);
    if (s.passed && !u.firstPass.has(s.exerciseId)) u.firstPass.set(s.exerciseId, s.createdAt.getTime());
  }

  const ranked = [...per.entries()]
    .map(([userId, u]) => ({
      userId,
      passed: u.firstPass.size,
      attempted: u.attempted.size,
      finishedAt: u.firstPass.size ? Math.max(...u.firstPass.values()) : Number.MAX_SAFE_INTEGER,
      score: Math.round((u.firstPass.size / total) * 100),
    }))
    .sort((a, b) => b.passed - a.passed || a.finishedAt - b.finishedAt || b.attempted - a.attempted);

  const names = await namesFor(ranked.slice(0, TOP).map((e) => e.userId));
  const board = finish(ranked, currentUserId, names, (e) => ({ passed: e.passed, attempted: e.attempted, totalExercises: total }));
  return { ...board, totalExercises: total };
}
