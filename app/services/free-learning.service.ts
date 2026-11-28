import { prisma } from "@/app/lib/prisma";

/**
 * Free sample lessons (Lesson.isFree) from active courses, for the public
 * /free-learning pages. Titles only here; the video itself comes from the
 * existing GET /api/lessons/[id]/play, which already allows free lessons
 * without login. Kept in memory for 5 minutes.
 */
export interface FreeLesson {
  id: string;
  title: string;
  duration: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  courseIcon: string;
  courseColor: string;
}

const TTL_MS = 5 * 60_000;
let cache: { at: number; lessons: FreeLesson[] } | null = null;

export async function getFreeLessons(): Promise<FreeLesson[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.lessons;
  try {
    const rows = await prisma.lesson.findMany({
      where: { isFree: true, module: { course: { isActive: true } } },
      orderBy: [{ module: { course: { createdAt: "asc" } } }, { module: { order: "asc" } }, { order: "asc" }],
      take: 200,
      select: {
        id: true, title: true, duration: true,
        module: { select: { title: true, course: { select: { id: true, title: true, icon: true, color: true } } } },
      },
    });
    const lessons = rows.map((l) => ({
      id: l.id, title: l.title, duration: l.duration,
      moduleTitle: l.module.title,
      courseId: l.module.course.id, courseTitle: l.module.course.title,
      courseIcon: l.module.course.icon, courseColor: l.module.course.color,
    }));
    cache = { at: Date.now(), lessons };
    return lessons;
  } catch {
    return cache?.lessons ?? [];
  }
}

export async function getFreeLesson(id: string) {
  const all = await getFreeLessons();
  const index = all.findIndex((l) => l.id === id);
  if (index === -1) return null;
  const lesson = all[index];
  const sameCourse = all.filter((l) => l.courseId === lesson.courseId);
  const pos = sameCourse.findIndex((l) => l.id === id);
  return { lesson, next: sameCourse[pos + 1] ?? all[index + 1] ?? null, moreInCourse: sameCourse.length };
}

/**
 * Free coding questions: the coding exercises of free lessons (with at least
 * one test case, so "Submit" can check them), up to FREE_CODING_PER_COURSE per
 * course. Opened in the classroom code editor; anyone can solve them because
 * the lesson is free (guests included). Kept in memory for 5 minutes.
 */
export interface FreeCodingProblem {
  id: string;
  title: string;
  difficulty: string;
  language: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  courseIcon: string;
  courseColor: string;
}

export const FREE_CODING_PER_COURSE = 5;
let codingCache: { at: number; problems: FreeCodingProblem[] } | null = null;

export async function getFreeCodingProblems(): Promise<FreeCodingProblem[]> {
  if (codingCache && Date.now() - codingCache.at < TTL_MS) return codingCache.problems;
  try {
    const rows = await prisma.exercise.findMany({
      where: {
        type: "coding",
        testCases: { some: {} },
        lesson: { isFree: true, module: { course: { isActive: true } } },
      },
      orderBy: [
        { lesson: { module: { course: { createdAt: "asc" } } } },
        { lesson: { module: { order: "asc" } } },
        { lesson: { order: "asc" } },
        { order: "asc" },
      ],
      take: 300,
      select: {
        id: true, title: true, difficulty: true, language: true,
        lesson: { select: { id: true, title: true, module: { select: { course: { select: { id: true, title: true, icon: true, color: true } } } } } },
      },
    });
    const perCourse = new Map<string, number>();
    const problems: FreeCodingProblem[] = [];
    for (const e of rows) {
      const c = e.lesson.module.course;
      const n = perCourse.get(c.id) ?? 0;
      if (n >= FREE_CODING_PER_COURSE) continue;
      perCourse.set(c.id, n + 1);
      problems.push({
        id: e.id, title: e.title, difficulty: e.difficulty || "medium", language: e.language || "",
        lessonId: e.lesson.id, lessonTitle: e.lesson.title,
        courseId: c.id, courseTitle: c.title, courseIcon: c.icon, courseColor: c.color,
      });
    }
    codingCache = { at: Date.now(), problems };
    return problems;
  } catch {
    return codingCache?.problems ?? [];
  }
}
