import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { apiSuccess, apiError } from "@/app/lib/response";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";
import { notifyCourseEnrolled, notifyPaymentFailed } from "@/app/lib/notification";
import { logger } from "@/app/lib/logger";
import crypto from "crypto";

/**
 * POST /api/payment/webhook
 * Handle Razorpay webhook for payment status updates.
 * Signature verification required (no auth — Razorpay calls this directly).
 * Hard-fails if RAZORPAY_WEBHOOK_SECRET is not configured.
 */
export async function POST(req: NextRequest) {
  try {
    // Hard-fail if webhook secret is not configured — prevents signature bypass
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.trim().length === 0) {
      logger.error("payment-webhook", "secret_not_configured", {});
      return apiError(503, "Payment webhook is not configured.");
    }

    const body = await req.json();
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      logger.warn("payment-webhook", "missing_signature", {});
      return apiError(400, "Signature verification failed.");
    }

    // Verify webhook signature using timing-safe comparison
    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(body)).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.warn("payment-webhook", "signature_mismatch", {});
      return apiError(401, "Signature verification failed.");
    }

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

      // Notification: course enrolled successfully (non-blocking, idempotent)
      notifyCourseEnrolled({
        userId: payment.userId,
        courseId: payment.courseId,
        courseName: payment.course.title,
        paymentId: razorpayPaymentId,
      }).catch(() => {});

      return apiSuccess({ message: "Payment verified and user enrolled." });
    }

    if (event === "payment.failed") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", razorpayPaymentId } });
      logger.error("payment-webhook", "payment_failed", { orderId: razorpayOrderId, paymentId: razorpayPaymentId });

      // Notification: payment failed (non-blocking, idempotent)
      notifyPaymentFailed({
        userId: payment.userId,
        courseId: payment.courseId,
        courseName: payment.course.title,
        orderId: razorpayOrderId,
      }).catch(() => {});

      return apiSuccess({ message: "Payment failure recorded." });
    }

    return apiSuccess({});
  } catch (err) {
    console.error("Webhook error:", err);
    return apiError(500, "Webhook processing failed.");
  }
}
