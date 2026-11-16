import { prisma } from "@/app/lib/prisma";
import { activeEnrollment, isActiveEnrollment } from "@/app/lib/access";

/**
 * Enrollment Repository
 * 
 * Centralizes all Enrollment table database operations.
 * Used by: quiz submission, code submission, course access checks.
 * "Enrolled" means an enrollment that hasn't ended (3-month plans end).
 */

/** Check if a user has active access to a specific course */
export async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, expiresAt: true },
  });
  return isActiveEnrollment(enrollment);
}

/** Enroll a user in a course (idempotent — upsert). No end date (free / admin enrolment). */
export async function enroll(userId: string, courseId: string): Promise<void> {
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId },
  });
}

/** Get all course IDs the user can use right now */
export async function getEnrolledCourseIds(userId: string): Promise<string[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, ...activeEnrollment() },
    select: { courseId: true },
  });
  return enrollments.map(e => e.courseId);
}

/** Get all user IDs with active access to a course (for fan-out, e.g. live-class notices) */
export async function getUsersEnrolledInCourse(courseId: string): Promise<string[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, ...activeEnrollment() },
    select: { userId: true },
  });
  return enrollments.map(e => e.userId);
}

/** Count active enrollments for a user */
export async function countByUser(userId: string): Promise<number> {
  return prisma.enrollment.count({ where: { userId, ...activeEnrollment() } });
}
