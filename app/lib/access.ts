/**
 * Course access = an enrollment that hasn't ended. Every "is this student
 * enrolled?" check goes through here, so a 3-month plan really ends after 3
 * months. Enrollments with no end date (all older ones, free and admin ones)
 * never end.
 */
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Prisma filter for enrollments that are still active right now. */
export function activeEnrollment(now: Date = new Date()): Prisma.EnrollmentWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

/** Is this enrollment row still active? (null/undefined row → false) */
export function isActiveEnrollment(e: { expiresAt?: Date | null } | null | undefined, now: Date = new Date()): boolean {
  return !!e && (!e.expiresAt || e.expiresAt.getTime() > now.getTime());
}

/** Does the student have active access to this course? */
export async function hasCourseAccess(userId: string, courseId: string): Promise<boolean> {
  const e = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { expiresAt: true },
  });
  return isActiveEnrollment(e);
}

/** Ids of every course the student can use right now. */
export async function activeCourseIds(userId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({
    where: { userId, ...activeEnrollment() },
    select: { courseId: true },
  });
  return rows.map((r) => r.courseId);
}
