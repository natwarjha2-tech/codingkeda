import { prisma } from "@/app/lib/prisma";

/**
 * Sync Student record when a user enrolls in a course.
 * - If Student record doesn't exist for this user, create it.
 * - If it already exists, update the enrolledCourses count.
 *
 * This ensures the Student table only contains users
 * who are enrolled in at least one course (actual students).
 */
export async function syncStudentOnEnroll(userId: string): Promise<void> {
  try {
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) return;

    // Count total enrollments for this user
    const enrollmentCount = await prisma.enrollment.count({
      where: { userId },
    });

    // Upsert Student record
    await prisma.student.upsert({
      where: { userId },
      update: {
        name: user.name,
        email: user.email,
        enrolledCourses: enrollmentCount,
      },
      create: {
        userId: user.id,
        name: user.name,
        email: user.email,
        enrolledCourses: enrollmentCount,
      },
    });
  } catch (error) {
    // Log but don't throw — enrollment should not fail because of student sync
    console.error("syncStudentOnEnroll error:", error);
  }
}
