import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { isActiveEnrollment } from "@/app/lib/access";
import { priceFor, ACCESS_DAYS, ZENALPHA_NAME, COUPON_MAX_PERCENT, type PlanId } from "@/app/lib/pricing";
import { zenAlphaCourses } from "@/app/services/plan-access.service";
import Razorpay from "razorpay";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

/**
 * POST /api/payment/create-order
 * body: { plan?: "zenalpha" | "course", courseId?: string, discountId?: string }
 *
 * The SERVER decides the price (₹1,999 − 70% = ₹599 for 3 months, then the
 * student's coupon, at most 30%). Any `amount` sent by the browser is ignored.
 *  - plan "zenalpha": AI, Cyber Safety, Robotics, GreenTech (courses marked
 *    "Include in ZenAlpha"). A course in ZenAlpha is always sold as ZenAlpha.
 *  - plan "course": one subject.
 * Buying again while access is on extends it (renewal); lifetime access can't be bought again.
 */
export async function POST(req: NextRequest) {
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return apiError(503, "Payment gateway not configured. Please contact support.");
    }

    const { error, user } = requireAuth(req);
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const discountId: string | undefined = body?.discountId ? String(body.discountId) : undefined;
    let plan: PlanId = body?.plan === "zenalpha" ? "zenalpha" : "course";
    let courseId: string | null = typeof body?.courseId === "string" && body.courseId.trim() ? body.courseId.trim() : null;

    // ── What is being bought ──
    let title = ZENALPHA_NAME;
    let coveredIds: string[] = [];
    if (plan === "course") {
      if (!courseId) return apiError(400, "Course ID is required.");
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return apiError(404, "Course not found.");
      if (course.inZenAlpha) {
        plan = "zenalpha"; // ZenAlpha subjects are sold together
      } else {
        title = course.title;
        coveredIds = [course.id];
      }
    }
    if (plan === "zenalpha") {
      const courses = await zenAlphaCourses();
      if (courses.length === 0) return apiError(503, "ZenAlpha is not available yet. Please check back soon.");
      coveredIds = courses.map((c) => c.id);
      courseId = null;
      title = ZENALPHA_NAME;
    }

    // Lifetime access can't be bought again; 3-month access can be renewed.
    const existing = await Promise.all(
      coveredIds.map((id) =>
        prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user!.userId, courseId: id } } }),
      ),
    );
    const allLifetime = existing.length > 0 && existing.every((e) => isActiveEnrollment(e) && !e!.expiresAt);
    if (allLifetime) {
      return apiError(409, plan === "zenalpha" ? "You already have ZenAlpha." : "You are already enrolled in this course.");
    }

    // ── Coupon (validated and capped SERVER-SIDE) ──
    let applied: { id: string; percent: number } | null = null;
    if (discountId) {
      const disc = await prisma.userDiscount.findFirst({
        where: { id: discountId, userId: user!.userId, consumed: false },
      });
      if (!disc) return apiError(400, "Discount is invalid, already used, or does not belong to you.");
      applied = { id: disc.id, percent: Math.max(0, Math.min(COUPON_MAX_PERCENT, disc.percent)) };
    }
    const price = priceFor(applied?.percent ?? 0);

    // Razorpay order for the FINAL amount.
    const amountInPaisa = Math.round(price.finalPrice * 100);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaisa,
      currency: "INR",
      receipt: `order_${user!.userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId: user!.userId,
        plan,
        ...(courseId ? { courseId } : {}),
        courseName: title,
        ...(applied ? { discountId: applied.id, discountPercent: String(applied.percent) } : {}),
      },
    });

    const payment = await prisma.payment.create({
      data: {
        userId: user!.userId,
        courseId,
        plan,
        razorpayOrderId: razorpayOrder.id,
        amount: amountInPaisa,
        status: "pending",
        discountId: applied?.id ?? null,
        discountPercent: applied?.percent ?? null,
      },
    });

    return apiSuccess({
      orderId: razorpayOrder.id,
      plan,
      title,
      amount: price.finalPrice, // ₹ to pay
      baseAmount: price.price, // ₹599 before the coupon
      listPrice: price.listPrice, // ₹1,999
      offPercent: price.offPercent, // 70
      discountPercent: price.couponPercent,
      couponOff: price.couponOff,
      accessDays: ACCESS_DAYS,
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
      paymentId: payment.id,
      userName: user!.email || "User",
      userEmail: user!.email || "",
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
