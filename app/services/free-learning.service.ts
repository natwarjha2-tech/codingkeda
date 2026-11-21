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
