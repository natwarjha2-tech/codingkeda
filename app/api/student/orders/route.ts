import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/student/orders
 * Returns all orders/payments for the logged-in student.
 * Used by: Desktop app "My Orders" section, Mobile app
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const orders = await prisma.payment.findMany({
      where: { userId: user!.userId },
      include: {
        course: { select: { id: true, title: true, icon: true, color: true, instructor: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      courseId: order.courseId,
      courseTitle: order.course.title,
      courseIcon: order.course.icon,
      courseColor: order.course.color,
      instructor: order.course.instructor,
      amount: order.amount / 100,
      status: order.status,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    return apiSuccess({
      orders: formattedOrders,
      totalSpent: formattedOrders.filter(o => o.status === "success").reduce((sum, o) => sum + o.amount, 0),
      totalOrders: formattedOrders.length,
    });
  } catch {
    return apiError(500, "Internal server error");
  }
}
