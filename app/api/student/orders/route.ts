import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/student/orders
 * Returns orders/payments for the logged-in student.
 * Used by: Desktop app "My Orders" section, Mobile app
 * 
 * Pagination (optional, backward-compatible):
 *   ?page=1&limit=20 → paginated response
 *   No params → returns all orders (legacy behavior)
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    // Parse optional pagination params
    const pageParam = req.nextUrl.searchParams.get("page");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : null;
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : null;
    const isPaginated = page !== null && limit !== null;

    // Get total count
    const totalOrders = await prisma.payment.count({
      where: { userId: user!.userId },
    });

    if (totalOrders === 0) {
      return apiSuccess({
        orders: [],
        totalSpent: 0,
        totalOrders: 0,
        ...(isPaginated && { page, limit, totalPages: 0 }),
      });
    }

    // Fetch orders with optional pagination
    const orders = await prisma.payment.findMany({
      where: { userId: user!.userId },
      include: {
        course: { select: { id: true, title: true, icon: true, color: true, instructor: true } },
      },
      orderBy: { createdAt: "desc" },
      ...(isPaginated && { skip: (page - 1) * limit, take: limit }),
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

    // totalSpent is always across ALL orders (not just current page)
    const totalSpent = isPaginated
      ? (await prisma.payment.aggregate({
          where: { userId: user!.userId, status: "success" },
          _sum: { amount: true },
        }))._sum.amount || 0
      : formattedOrders.filter(o => o.status === "success").reduce((sum, o) => sum + o.amount, 0);

    return apiSuccess({
      orders: formattedOrders,
      totalSpent: isPaginated ? totalSpent / 100 : totalSpent,
      totalOrders,
      ...(isPaginated && { page, limit, totalPages: Math.ceil(totalOrders / limit) }),
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
