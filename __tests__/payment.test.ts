/**
 * Unit tests — payment routes (Razorpay)
 *   • POST /api/payment/create-order
 *   • POST /api/payment/webhook
 *
 * FULLY MOCKED — prisma, Razorpay SDK, student-sync, notifications, referral and
 * the logger are all mocked. crypto stays REAL so webhook signature
 * verification is exercised end-to-end (we compute a valid HMAC in the test).
 * No real DB / network / payment gateway is ever touched.
 */

// Payment gateway + JWT env must exist BEFORE importing the routes (create-order
// reads the Razorpay keys at module load; auth.ts needs a >=32 char secret).
// Test-only env — never touches production config or the database.
process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-only-jwt-secret-value-0123456789-abcdef";
}

const mockOrdersCreate = jest.fn();
jest.mock("razorpay", () => {
  return jest.fn().mockImplementation(() => ({
    orders: { create: (...args: unknown[]) => mockOrdersCreate(...args) },
  }));
});

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    course: { findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn(), upsert: jest.fn() },
    userDiscount: { findFirst: jest.fn(), updateMany: jest.fn() },
    payment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("@/app/lib/sync-student", () => ({ syncStudentOnEnroll: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/app/lib/notification", () => ({
  notifyCourseEnrolled: jest.fn().mockResolvedValue(undefined),
  notifyPaymentFailed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/app/lib/referral", () => ({ rewardReferrerOnFirstPurchase: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import crypto from "crypto";
import { POST as createOrder } from "@/app/api/payment/create-order/route";
import { POST as webhook } from "@/app/api/payment/webhook/route";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";
import { notifyCourseEnrolled, notifyPaymentFailed } from "@/app/lib/notification";
import { rewardReferrerOnFirstPurchase } from "@/app/lib/referral";

const mCourseFind = prisma.course.findUnique as jest.MockedFunction<typeof prisma.course.findUnique>;
const mEnrollFind = prisma.enrollment.findUnique as jest.MockedFunction<typeof prisma.enrollment.findUnique>;
const mEnrollUpsert = prisma.enrollment.upsert as jest.MockedFunction<typeof prisma.enrollment.upsert>;
const mDiscFind = prisma.userDiscount.findFirst as jest.MockedFunction<typeof prisma.userDiscount.findFirst>;
const mDiscUpdateMany = prisma.userDiscount.updateMany as jest.MockedFunction<typeof prisma.userDiscount.updateMany>;
const mPayCreate = prisma.payment.create as jest.MockedFunction<typeof prisma.payment.create>;
const mPayFind = prisma.payment.findUnique as jest.MockedFunction<typeof prisma.payment.findUnique>;
const mPayUpdate = prisma.payment.update as jest.MockedFunction<typeof prisma.payment.update>;
const mSync = syncStudentOnEnroll as jest.MockedFunction<typeof syncStudentOnEnroll>;
const mNotifyEnrolled = notifyCourseEnrolled as jest.MockedFunction<typeof notifyCourseEnrolled>;
const mNotifyFailed = notifyPaymentFailed as jest.MockedFunction<typeof notifyPaymentFailed>;
const mReward = rewardReferrerOnFirstPurchase as jest.MockedFunction<typeof rewardReferrerOnFirstPurchase>;

const TOKEN = signToken({ userId: "user-1", email: "u@test.com", role: "user" });

const authedReq = (body: unknown, token = TOKEN) => {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("authorization", `Bearer ${token}`);
  return { json: async () => body, headers } as never;
};

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks() wipes the factory's mockResolvedValue, so re-arm the
  // fire-and-forget side-effects the webhook calls `.catch()` on — they MUST
  // return a Promise, or the route throws "Cannot read properties of ... catch".
  mSync.mockResolvedValue(undefined);
  mNotifyEnrolled.mockResolvedValue(undefined as never);
  mNotifyFailed.mockResolvedValue(undefined as never);
  mReward.mockResolvedValue(undefined as never);
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/payment/create-order
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/payment/create-order", () => {
  it("401 without authentication", async () => {
    const headers = new Headers();
    const res = await createOrder({ json: async () => ({ courseId: "c1", amount: 100 }), headers } as never);
    expect(res.status).toBe(401);
  });

  it("400 when courseId is missing", async () => {
    const res = await createOrder(authedReq({ amount: 100 }));
    expect(res.status).toBe(400);
  });

  it("400 when amount is invalid", async () => {
    expect((await createOrder(authedReq({ courseId: "c1", amount: 0 }))).status).toBe(400);
    expect((await createOrder(authedReq({ courseId: "c1", amount: -5 }))).status).toBe(400);
  });

  it("404 when the course doesn't exist", async () => {
    mCourseFind.mockResolvedValue(null as never);
    expect((await createOrder(authedReq({ courseId: "c1", amount: 100 }))).status).toBe(404);
  });

  it("409 when the user is already enrolled", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", title: "Course" } as never);
    mEnrollFind.mockResolvedValue({ userId: "user-1", courseId: "c1" } as never);
    expect((await createOrder(authedReq({ courseId: "c1", amount: 100 }))).status).toBe(409);
  });

  it("creates an order + pending payment for the full amount (no discount)", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", title: "Course" } as never);
    mEnrollFind.mockResolvedValue(null as never);
    mockOrdersCreate.mockResolvedValue({ id: "order_123" });
    mPayCreate.mockResolvedValue({ id: "pay-1" } as never);

    const res = await createOrder(authedReq({ courseId: "c1", amount: 500 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.orderId).toBe("order_123");
    expect(data.amount).toBe(500);
    expect(data.discountPercent).toBe(0);
    // amount passed to Razorpay is in paisa
    expect(mockOrdersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 50000, currency: "INR" }));
    // stored payment amount is also in paisa
    expect(mPayCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 50000, status: "pending", discountId: null }),
    }));
  });

  it("applies a valid discount server-side (never trusts client price)", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", title: "Course" } as never);
    mEnrollFind.mockResolvedValue(null as never);
    mDiscFind.mockResolvedValue({ id: "disc-1", percent: 20, userId: "user-1", consumed: false } as never);
    mockOrdersCreate.mockResolvedValue({ id: "order_d" });
    mPayCreate.mockResolvedValue({ id: "pay-2" } as never);

    const res = await createOrder(authedReq({ courseId: "c1", amount: 1000, discountId: "disc-1" }));
    const data = await res.json();

    expect(data.amount).toBe(800); // 1000 - 20%
    expect(data.discountPercent).toBe(20);
    expect(mockOrdersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 80000 }));
  });

  it("400 when the discount is invalid / not the user's / already used", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", title: "Course" } as never);
    mEnrollFind.mockResolvedValue(null as never);
    mDiscFind.mockResolvedValue(null as never);
    expect((await createOrder(authedReq({ courseId: "c1", amount: 1000, discountId: "bad" }))).status).toBe(400);
  });

  it("500 when Razorpay order creation throws", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", title: "Course" } as never);
    mEnrollFind.mockResolvedValue(null as never);
    mockOrdersCreate.mockRejectedValue(new Error("gateway down"));
    expect((await createOrder(authedReq({ courseId: "c1", amount: 100 }))).status).toBe(500);
  });

  it("502 when Razorpay reports an authentication failure", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", title: "Course" } as never);
    mEnrollFind.mockResolvedValue(null as never);
    mockOrdersCreate.mockRejectedValue(new Error("authentication failed (401)"));
    expect((await createOrder(authedReq({ courseId: "c1", amount: 100 }))).status).toBe(502);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/payment/webhook
// ═════════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET = "test-webhook-secret";
const sign = (body: unknown) =>
  crypto.createHmac("sha256", WEBHOOK_SECRET).update(JSON.stringify(body)).digest("hex");

const webhookReq = (body: unknown, signature?: string) => {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  const sig = signature !== undefined ? signature : sign(body);
  if (sig) headers.set("x-razorpay-signature", sig);
  return { json: async () => body, headers } as never;
};

const capturedBody = (event: string) => ({
  event,
  payload: { payment: { entity: { order_id: "order_123", id: "pay_abc" } } },
});

describe("POST /api/payment/webhook", () => {
  it("400 when the signature header is missing", async () => {
    const res = await webhook(webhookReq(capturedBody("payment.captured"), ""));
    expect(res.status).toBe(400);
  });

  it("401 when the signature does not match", async () => {
    const res = await webhook(webhookReq(capturedBody("payment.captured"), "0".repeat(64)));
    expect(res.status).toBe(401);
  });

  it("400 on an invalid payload (no event/entity)", async () => {
    const res = await webhook(webhookReq({ foo: "bar" }));
    expect(res.status).toBe(400);
  });

  it("404 when no payment record matches the order id", async () => {
    mPayFind.mockResolvedValue(null as never);
    const res = await webhook(webhookReq(capturedBody("payment.captured")));
    expect(res.status).toBe(404);
  });

  it("captures payment → marks success, enrolls, syncs + notifies", async () => {
    mPayFind.mockResolvedValue({
      id: "pay-1", userId: "user-1", courseId: "c1", discountId: null,
      course: { title: "Course" }, user: { id: "user-1" },
    } as never);
    mPayUpdate.mockResolvedValue({} as never);
    mEnrollUpsert.mockResolvedValue({} as never);

    const res = await webhook(webhookReq(capturedBody("payment.captured")));
    expect(res.status).toBe(200);
    expect(mPayUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "success" }) }));
    expect(mEnrollUpsert).toHaveBeenCalled();
    expect(mSync).toHaveBeenCalledWith("user-1");
    expect(mNotifyEnrolled).toHaveBeenCalled();
  });

  it("consumes the applied discount on a successful capture", async () => {
    mPayFind.mockResolvedValue({
      id: "pay-1", userId: "user-1", courseId: "c1", discountId: "disc-1",
      course: { title: "Course" }, user: { id: "user-1" },
    } as never);
    mPayUpdate.mockResolvedValue({} as never);
    mEnrollUpsert.mockResolvedValue({} as never);
    mDiscUpdateMany.mockResolvedValue({ count: 1 } as never);

    await webhook(webhookReq(capturedBody("payment.captured")));
    expect(mDiscUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ consumed: true }),
    }));
  });

  it("handles payment.authorized the same as captured", async () => {
    mPayFind.mockResolvedValue({
      id: "pay-1", userId: "user-1", courseId: "c1", discountId: null,
      course: { title: "Course" }, user: { id: "user-1" },
    } as never);
    mPayUpdate.mockResolvedValue({} as never);
    mEnrollUpsert.mockResolvedValue({} as never);

    const res = await webhook(webhookReq(capturedBody("payment.authorized")));
    expect(res.status).toBe(200);
    expect(mEnrollUpsert).toHaveBeenCalled();
  });

  it("payment.failed → marks failed + notifies, no enrollment", async () => {
    mPayFind.mockResolvedValue({
      id: "pay-1", userId: "user-1", courseId: "c1", discountId: null,
      course: { title: "Course" }, user: { id: "user-1" },
    } as never);
    mPayUpdate.mockResolvedValue({} as never);

    const res = await webhook(webhookReq(capturedBody("payment.failed")));
    expect(res.status).toBe(200);
    expect(mPayUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }));
    expect(mEnrollUpsert).not.toHaveBeenCalled();
    expect(mNotifyFailed).toHaveBeenCalled();
  });

  it("ignores an unrelated event (200, no side effects)", async () => {
    mPayFind.mockResolvedValue({
      id: "pay-1", userId: "user-1", courseId: "c1", discountId: null,
      course: { title: "Course" }, user: { id: "user-1" },
    } as never);
    const res = await webhook(webhookReq(capturedBody("payment.pending")));
    expect(res.status).toBe(200);
    expect(mEnrollUpsert).not.toHaveBeenCalled();
    expect(mPayUpdate).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Webhook — secret-not-configured branch (isolated module reload)
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/payment/webhook — secret not configured", () => {
  it("503 when RAZORPAY_WEBHOOK_SECRET is empty", async () => {
    const original = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = "";
    try {
      const res = await webhook(webhookReq(capturedBody("payment.captured"), "sig"));
      expect(res.status).toBe(503);
    } finally {
      process.env.RAZORPAY_WEBHOOK_SECRET = original;
    }
  });
});
