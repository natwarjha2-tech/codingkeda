import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import Razorpay from "razorpay";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

/**
 * POST /api/payment/create-order
 * Create a Razorpay order for course payment
 * Requires: Bearer token, courseId, amount
 */
export async function POST(req: NextRequest) {
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return apiError(503, "Payment gateway not configured. Please contact support.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const { courseId, amount } = await req.json();
    if (!courseId?.trim()) return apiError(400, "Course ID is required.");
    if (!amount || amount <= 0 || isNaN(Number(amount))) return apiError(400, "Valid amount is required.");

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return apiError(404, "Course not found.");

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user!.userId, courseId } },
    });
    if (existingEnrollment) return apiError(409, "You are already enrolled in this course.");

    // Create Razorpay order
    const amountInPaisa = Math.round(Number(amount) * 100);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaisa,
      currency: "INR",
      receipt: `order_${user!.userId.slice(0, 8)}_${Date.now()}`,
      notes: { userId: user!.userId, courseId, courseName: course.title },
    });

    // Store payment record
    const payment = await prisma.payment.create({
      data: { userId: user!.userId, courseId, razorpayOrderId: razorpayOrder.id, amount: amountInPaisa, status: "pending" },
    });

    return apiSuccess({
      orderId: razorpayOrder.id, amount: Number(amount), currency: "INR", keyId: RAZORPAY_KEY_ID,
      paymentId: payment.id, userName: user!.email || "User", userEmail: user!.email || "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    logger.error("payment-create-order", "unhandled_error", { error: msg });
    if (msg.includes("authentication") || msg.includes("unauthorized") || msg.includes("401")) {
      return apiError(502, "Payment gateway authentication failed. Please contact support.");
    }
    return apiError(500, "Failed to create payment order. Please try again.");
  }
}
