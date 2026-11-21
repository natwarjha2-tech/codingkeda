import { prisma } from "@/app/lib/prisma";

/**
 * Data for the public home page. Read-only, and kept in memory for 5 minutes
 * so the home page does not hit the database on every visit.
 */

export interface HomeCourse {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  color: string;
  icon: string;
  rating: number;
  totalHours: number;
  lessonCount: number;
  studentCount: number;
  hasCert: boolean;
  inZenAlpha: boolean;
}

const TTL_MS = 5 * 60_000;
let cache: { at: number; courses: HomeCourse[] } | null = null;

export async function getHomeCourses(): Promise<HomeCourse[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.courses;
  try {
    const rows = await prisma.course.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, title: true, subtitle: true, category: true, color: true, icon: true,
        rating: true, totalHours: true, hasCert: true, inZenAlpha: true,
        _count: { select: { enrollments: true } },
        modules: { select: { _count: { select: { lessons: true } } } },
      },
    });
    const courses: HomeCourse[] = rows.map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      category: c.category,
      color: c.color,
      icon: c.icon,
      rating: c.rating,
      totalHours: c.totalHours,
      lessonCount: c.modules.reduce((s, m) => s + m._count.lessons, 0),
      studentCount: c._count.enrollments,
      hasCert: c.hasCert,
      inZenAlpha: c.inZenAlpha,
    }));
    cache = { at: Date.now(), courses };
    return courses;
  } catch {
    // Never break the home page because of the database: show the last good list, or none.
    return cache?.courses ?? [];
  }
}

// ── Public course detail (safe fields only: no video URLs, notes or files) ──

export interface PublicCourse extends HomeCourse {
  instructor: string;
  institute: string;
  modules: { id: string; title: string; lessons: { id: string; title: string; duration: string; isFree: boolean }[] }[];
  quizCount: number;
  exerciseCount: number;
}

const detailCache = new Map<string, { at: number; course: PublicCourse | null }>();

export async function getPublicCourse(id: string): Promise<PublicCourse | null> {
  if (!id || id.length > 64) return null;
  const hit = detailCache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.course;
  try {
    const c = await prisma.course.findFirst({
      where: { id, isActive: true },
      select: {
        id: true, title: true, subtitle: true, category: true, color: true, icon: true,
        rating: true, totalHours: true, hasCert: true, inZenAlpha: true, instructor: true, institute: true,
        _count: { select: { enrollments: true } },
        modules: {
          orderBy: { order: "asc" },
          select: {
            id: true, title: true,
            lessons: {
              orderBy: { order: "asc" },
              select: { id: true, title: true, duration: true, isFree: true, _count: { select: { quizzes: true, exercises: true } } },
            },
          },
        },
      },
    });
    let course: PublicCourse | null = null;
    if (c) {
      const lessons = c.modules.flatMap((m) => m.lessons);
      course = {
        id: c.id, title: c.title, subtitle: c.subtitle, category: c.category, color: c.color, icon: c.icon,
        rating: c.rating, totalHours: c.totalHours, hasCert: c.hasCert, inZenAlpha: c.inZenAlpha,
        instructor: c.instructor, institute: c.institute,
        lessonCount: lessons.length,
        studentCount: c._count.enrollments,
        quizCount: lessons.reduce((s, l) => s + l._count.quizzes, 0),
        exerciseCount: lessons.reduce((s, l) => s + l._count.exercises, 0),
        modules: c.modules.map((m) => ({
          id: m.id, title: m.title,
          lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, duration: l.duration, isFree: l.isFree })),
        })),
      };
    }
    detailCache.set(id, { at: Date.now(), course });
    return course;
  } catch {
    return hit?.course ?? null;
  }
}
