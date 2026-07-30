import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/student/subscription
 * Returns current subscription/plan status for the logged-in student.
 * Per-course purchase model — enrollment = active access.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const dbUser = await prisma.user.findUnique({
      where: { id: user!.userId },
      select: { name: true, email: true, createdAt: true },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { userId: user!.userId },
      include: { course: { select: { id: true, title: true, icon: true, color: true } } },
      orderBy: { createdAt: "desc" },
    });

    const payments = await prisma.payment.findMany({
      where: { userId: user!.userId, status: "success" },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0) / 100;

    return apiSuccess({
      subscription: {
        plan: enrollments.length > 0 ? "Active Learner" : "Free",
        status: enrollments.length > 0 ? "active" : "inactive",
        memberSince: dbUser?.createdAt,
        coursesEnrolled: enrollments.length,
        totalSpent,
        lastPaymentDate: payments[0]?.createdAt || null,
        enrolledCourses: enrollments.map(e => ({ courseId: e.course.id, title: e.course.title, icon: e.course.icon, color: e.course.color, enrolledAt: e.createdAt })),
      },
    });
  } catch {
    return apiError(500, "Internal server error");
  }
}
