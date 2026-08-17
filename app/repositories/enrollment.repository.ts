import { prisma } from "@/app/lib/prisma";

/**
 * Enrollment Repository
 * 
 * Centralizes all Enrollment table database operations.
 * Used by: quiz submission, code submission, course access checks.
 */

/** Check if a user is enrolled in a specific course */
export async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  return !!enrollment;
}

/** Enroll a user in a course (idempotent — upsert) */
export async function enroll(userId: string, courseId: string): Promise<void> {
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId },
  });
}

/** Get all enrolled course IDs for a user */
export async function getEnrolledCourseIds(userId: string): Promise<string[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true },
  });
  return enrollments.map(e => e.courseId);
}

/** Count total enrollments for a user */
export async function countByUser(userId: string): Promise<number> {
  return prisma.enrollment.count({ where: { userId } });
}
