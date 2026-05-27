import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";
import crypto from "crypto";
import { logger } from "@/app/lib/logger";

/**
 * POST /api/payment/webhook
 * Handle Razorpay webhook for payment status updates
 * Signature verification is required
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      console.error("Missing signature in webhook");
      return NextResponse.json(
        { success: false, message: "Signature verification failed." },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    const message = JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(message)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("Signature mismatch - possible fake webhook");
      return NextResponse.json(
        { success: false, message: "Signature verification failed." },
        { status: 401 }
      );
    }

    const event = body.event;
    const paymentData = body.payload?.payment?.entity;

    if (!event || !paymentData) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook payload." },
        { status: 400 }
      );
    }

    const razorpayOrderId = paymentData.order_id;
    const razorpayPaymentId = paymentData.id;

    // Find payment in database
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
      include: { course: true, user: true },
    });

    if (!payment) {
      console.error(`Payment not found for order ${razorpayOrderId}`);
      return NextResponse.json(
        { success: false, message: "Payment record not found." },
        { status: 404 }
      );
    }

    // Handle different payment events
    if (event === "payment.authorized" || event === "payment.captured") {
      // Payment successful
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "success",
          razorpayPaymentId: razorpayPaymentId,
        },
      });

      // Auto-enroll user in course
      await prisma.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: payment.userId,
            courseId: payment.courseId,
          },
        },
        update: {},
        create: {
          userId: payment.userId,
          courseId: payment.courseId,
        },
      });

      // Sync Student record
      await syncStudentOnEnroll(payment.userId);

      console.log(
        `Payment success: ${razorpayPaymentId} - User ${payment.userId} enrolled in ${payment.courseId}`
      );
      logger.success("payment-webhook", "enrollment_complete", { userId: payment.userId, courseId: payment.courseId, paymentId: razorpayPaymentId });

      return NextResponse.json({
        success: true,
        message: "Payment verified and user enrolled.",
      });
    } else if (event === "payment.failed") {
      // Payment failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          razorpayPaymentId: razorpayPaymentId,
        },
      });

      console.log(`Payment failed: ${razorpayPaymentId} - Order ${razorpayOrderId}`);
      logger.error("payment-webhook", "payment_failed", { orderId: razorpayOrderId, paymentId: razorpayPaymentId });

      return NextResponse.json({
        success: true,
        message: "Payment failure recorded.",
      });
    }

    // Silently accept other events
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { success: false, message: "Webhook processing failed." },
      { status: 500 }
    );
  }
}
