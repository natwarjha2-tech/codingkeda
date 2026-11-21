import { prisma } from "@/app/lib/prisma";

/**
 * Public, read-only list of upcoming and live classes for the website.
 * Safe fields only (no meeting ids, host ids or recordings). Joining still
 * goes through the existing login + enrolment checks in /api/live/classes/[id]/join.
 * Kept in memory for 60 seconds.
 */
export interface PublicLiveClass {
  id: string;
  title: string;
  agenda: string;
  instructorName: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  status: "scheduled" | "live";
  courseId: string;
  courseTitle: string;
}

let cache: { at: number; classes: PublicLiveClass[] } | null = null;

export async function getPublicLiveClasses(): Promise<PublicLiveClass[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.classes;
  try {
    const since = new Date(Date.now() - 3 * 60 * 60 * 1000); // classes that started up to 3 hours ago
    const rows = await prisma.liveClass.findMany({
      where: {
        OR: [
          { status: "live" },
          { status: "scheduled", OR: [{ scheduledAt: null }, { scheduledAt: { gte: since } }] },
        ],
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: 60,
      select: { id: true, title: true, agenda: true, instructorName: true, scheduledAt: true, durationMinutes: true, status: true, courseId: true },
    });
    const courseIds = Array.from(new Set(rows.map((r) => r.courseId)));
    const courses = courseIds.length
      ? await prisma.course.findMany({ where: { id: { in: courseIds }, isActive: true }, select: { id: true, title: true } })
      : [];
    const title = new Map(courses.map((c) => [c.id, c.title]));
    const classes: PublicLiveClass[] = rows
      .filter((r) => title.has(r.courseId))
      .map((r) => ({
        id: r.id,
        title: r.title,
        agenda: r.agenda ?? "",
        instructorName: r.instructorName ?? "",
        scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
        durationMinutes: r.durationMinutes ?? null,
        status: r.status === "live" ? "live" : "scheduled",
        courseId: r.courseId,
        courseTitle: title.get(r.courseId) ?? "",
      }))
      // live first, then by time
      .sort((a, b) => (a.status === b.status ? (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") : a.status === "live" ? -1 : 1));
    cache = { at: Date.now(), classes };
    return classes;
  } catch {
    return cache?.classes ?? [];
  }
}

export async function getPublicLiveClass(id: string) {
  return (await getPublicLiveClasses()).find((c) => c.id === id) ?? null;
}
