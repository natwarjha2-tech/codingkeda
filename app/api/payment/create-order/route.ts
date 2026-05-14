import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import Razorpay from "razorpay";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

/**
 * POST /api/payment/create-order
 * Create a Razorpay order for course payment
 * Requires: Bearer token, courseId, amount
 */
export async function POST(req: NextRequest) {
  try {
    // Check Razorpay configuration
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Razorpay keys not configured");
      return NextResponse.json(
        { success: false, message: "Payment gateway not configured. Please contact support." },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return NextResponse.json(
        { success: false, message: "Session expired. Please login again." },
        { status: 401 }
      );
    }

    const { courseId, amount } = await req.json();

    if (!courseId?.trim()) {
      return NextResponse.json(
        { success: false, message: "Course ID is required." },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0 || isNaN(Number(amount))) {
      return NextResponse.json(
        { success: false, message: "Valid amount is required." },
        { status: 400 }
      );
    }

    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    // Check if user is already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: payload.userId, courseId } },
    });
    if (existingEnrollment) {
      return NextResponse.json(
        { success: false, message: "You are already enrolled in this course." },
        { status: 409 }
      );
    }

    // Create Razorpay order
    const amountInPaisa = Math.round(Number(amount) * 100);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaisa,
      currency: "INR",
      receipt: `order_${payload.userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId: payload.userId,
        courseId: courseId,
        courseName: course.title,
      },
    });

    // Store payment record in database with pending status
    const payment = await prisma.payment.create({
      data: {
        userId: payload.userId,
        courseId: courseId,
        razorpayOrderId: razorpayOrder.id,
        amount: amountInPaisa,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: Number(amount),
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
      paymentId: payment.id,
      userName: payload.email || "User",
      userEmail: payload.email || "",
    });
  } catch (error) {
    console.error("Payment creation error:", error);

    // Provide specific error messages based on error type
    const errMsg = error instanceof Error ? error.message : "";

    if (errMsg.includes("authentication") || errMsg.includes("unauthorized") || errMsg.includes("401")) {
      return NextResponse.json(
        { success: false, message: "Payment gateway authentication failed. Please contact support." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to create payment order. Please try again." },
      { status: 500 }
    );
  }
}
