import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/student/subscription
 * Returns current subscription/plan status for the logged-in student.
 * Used by: Desktop app, Mobile app
 * 
 * Note: Currently CodingKida uses per-course purchase model.
 * This endpoint returns enrollment-based "subscription" info.
 * Can be extended later for monthly/yearly subscription plans.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    const userId = payload.userId;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    });

    // Get all enrollments (active courses = current plan)
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: { id: true, title: true, icon: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get successful payments
    const payments = await prisma.payment.findMany({
      where: { userId, status: "success" },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0) / 100;
    const memberSince = user?.createdAt;
    const lastPayment = payments[0]?.createdAt || null;

    return NextResponse.json({
      success: true,
      subscription: {
        plan: enrollments.length > 0 ? "Active Learner" : "Free",
        status: enrollments.length > 0 ? "active" : "inactive",
        memberSince,
        coursesEnrolled: enrollments.length,
        totalSpent,
        lastPaymentDate: lastPayment,
        enrolledCourses: enrollments.map(e => ({
          courseId: e.course.id,
          title: e.course.title,
          icon: e.course.icon,
          color: e.course.color,
          enrolledAt: e.createdAt,
        })),
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
