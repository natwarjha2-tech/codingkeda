import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { apiSuccess, apiError } from "@/app/lib/response";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";
import { logger } from "@/app/lib/logger";
import crypto from "crypto";

/**
 * POST /api/payment/webhook
 * Handle Razorpay webhook for payment status updates
 * Signature verification required (no auth — Razorpay calls this)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) return apiError(400, "Signature verification failed.");

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(body)).digest("hex");
    if (signature !== expectedSignature) return apiError(401, "Signature verification failed.");

    const event = body.event;
    const paymentData = body.payload?.payment?.entity;
    if (!event || !paymentData) return apiError(400, "Invalid webhook payload.");

    const razorpayOrderId = paymentData.order_id;
    const razorpayPaymentId = paymentData.id;

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
      include: { course: true, user: true },
    });
    if (!payment) return apiError(404, "Payment record not found.");

    if (event === "payment.authorized" || event === "payment.captured") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "success", razorpayPaymentId } });

      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
        update: {},
        create: { userId: payment.userId, courseId: payment.courseId },
      });

      await syncStudentOnEnroll(payment.userId);
      logger.success("payment-webhook", "enrollment_complete", { userId: payment.userId, courseId: payment.courseId, paymentId: razorpayPaymentId });
      return apiSuccess({ message: "Payment verified and user enrolled." });
    }

    if (event === "payment.failed") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", razorpayPaymentId } });
      logger.error("payment-webhook", "payment_failed", { orderId: razorpayOrderId, paymentId: razorpayPaymentId });
      return apiSuccess({ message: "Payment failure recorded." });
    }

    return apiSuccess({});
  } catch (err) {
    console.error("Webhook error:", err);
    return apiError(500, "Webhook processing failed.");
  }
}
