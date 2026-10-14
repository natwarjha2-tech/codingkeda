/**
 * CodingKida — Live Class permissions (ISOLATED MODULE)
 *
 * Access rules for the live-class feature, reusing the SAME identity logic the
 * rest of the app already relies on — NO new conventions, NO duplicated data:
 *
 * - Instructor of a course is identified two ways (either qualifies):
 *     1. Course.createdBy === userId  (admin who created the course), and
 *     2. Course.instructorEmail → User.email (the assigned instructor account)
 *   This mirrors the lesson-chat instructor resolution so behaviour stays
 *   consistent across features.
 * - Enrolled student = an Enrollment row for (userId, courseId) — same lookup
 *   used by lesson-chat and course access everywhere else.
 *
 * These helpers are pure read-only DB checks (no writes, no side effects).
 */

import { prisma } from "@/app/lib/prisma";

/**
 * Is this user the instructor/owner of the course?
 * True if they created the course OR their email matches the course's
 * assigned instructorEmail.
 */
export async function isCourseInstructor(
  userId: string,
  courseId: string
): Promise<boolean> {
  if (!userId || !courseId) return false;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { createdBy: true, instructorEmail: true },
  });
  if (!course) return false;

  // 1) Course creator (admin) is always treated as the host/instructor.
  if (course.createdBy && course.createdBy === userId) return true;

  // 2) Assigned instructor, resolved via instructorEmail → User.email.
  const email = (course.instructorEmail || "").trim().toLowerCase();
  if (!email) return false;

  const instructor = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return !!instructor && instructor.id === userId;
}

/**
 * Is this user an enrolled student of the course?
 */
export async function isEnrolledStudent(
  userId: string,
  courseId: string
): Promise<boolean> {
  if (!userId || !courseId) return false;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  return !!enrollment;
}

/**
 * Minimal shape needed to evaluate join access (so callers can pass a loaded
 * LiveClass row without this module importing Prisma types).
 */
export interface JoinableClass {
  courseId: string;
  hostUserId: string;
}

/**
 * Can this user JOIN the given class?
 * Allowed for the class host, the course instructor, or an enrolled student.
 * Returns the resolved role so callers can store it on the participant row.
 */
export async function resolveJoinAccess(
  userId: string,
  liveClass: JoinableClass
): Promise<{ allowed: boolean; role: "teacher" | "student" }> {
  if (!userId) return { allowed: false, role: "student" };

  // Host of this specific class, or instructor/owner of its course → teacher.
  if (liveClass.hostUserId === userId) return { allowed: true, role: "teacher" };
  if (await isCourseInstructor(userId, liveClass.courseId)) {
    return { allowed: true, role: "teacher" };
  }

  // Otherwise must be an enrolled student of the course.
  if (await isEnrolledStudent(userId, liveClass.courseId)) {
    return { allowed: true, role: "student" };
  }

  return { allowed: false, role: "student" };
}
