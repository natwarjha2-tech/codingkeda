import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/student/orders
 * Returns all orders/payments for the logged-in student.
 * Used by: Desktop app "My Orders" section, Mobile app
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    const userId = payload.userId;

    const orders = await prisma.payment.findMany({
      where: { userId },
      include: {
        course: {
          select: { id: true, title: true, icon: true, color: true, instructor: true },
        },
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
      amount: order.amount / 100, // Convert paisa to rupees
      status: order.status,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      totalSpent: formattedOrders.filter(o => o.status === "success").reduce((sum, o) => sum + o.amount, 0),
      totalOrders: formattedOrders.length,
    });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
