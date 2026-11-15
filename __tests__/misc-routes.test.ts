/**
 * Unit tests — Miscellaneous content routes (Phase 7, batch A)
 *   • POST /api/feedback
 *   • GET  /api/mall
 *   • POST /api/mall/redeem        (coupon / referral / coin-offer paths)
 *   • GET  /api/mall/history
 *   • GET  /api/referral
 *   • GET  /api/discount
 *   • GET  /api/health             (no auth)
 *   • GET  /api/app-config         (no auth)
 *   • POST/DELETE /api/devices/register
 *   • GET/POST /api/attendance
 *   • GET  /api/demo-video         (no auth)
 *
 * FULLY MOCKED — prisma, referral lib, notification lib, s3 signer and logger
 * are all mocked. Auth is REAL (test-only JWT). No real DB / AWS / network is
 * ever touched — zero production side effects.
 */

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-only-jwt-secret-value-0123456789-abcdef";
}

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    surveyResponse: { create: jest.fn() },
    userCoins: { findUnique: jest.fn() },
    coinTransaction: { findMany: jest.fn() },
    userDiscount: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    referral: { findMany: jest.fn(), findUnique: jest.fn() },
    payment: { count: jest.fn() },
    userDevice: { upsert: jest.fn(), updateMany: jest.fn() },
    dailyActivity: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    user: { findUnique: jest.fn() },
    siteConfig: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/app/lib/referral", () => ({
  ensureReferralCode: jest.fn(),
  applyReferralCode: jest.fn(),
  REFERRAL_REWARD_NEW_USER: 50,
  REFERRAL_REWARD_REFERRER: 50,
}));

jest.mock("@/app/lib/notification", () => ({
  notifyCoinsSpent: jest.fn().mockResolvedValue(undefined),
  notifyCouponRedeemed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/lib/s3", () => ({
  getSignedFileUrl: jest.fn(),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { POST as feedback } from "@/app/api/feedback/route";
import { GET as mall } from "@/app/api/mall/route";
import { POST as mallRedeem } from "@/app/api/mall/redeem/route";
import { GET as mallHistory } from "@/app/api/mall/history/route";
import { GET as referral } from "@/app/api/referral/route";
import { GET as discount } from "@/app/api/discount/route";
import { GET as health } from "@/app/api/health/route";
import { GET as appConfig } from "@/app/api/app-config/route";
import { POST as deviceRegister, DELETE as deviceDelete } from "@/app/api/devices/register/route";
import { GET as attendanceGet, POST as attendancePost } from "@/app/api/attendance/route";
import { GET as demoVideo } from "@/app/api/demo-video/route";

import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { ensureReferralCode, applyReferralCode } from "@/app/lib/referral";
import { getSignedFileUrl } from "@/app/lib/s3";

const mSurveyCreate = prisma.surveyResponse.create as jest.MockedFunction<typeof prisma.surveyResponse.create>;
const mCoinsFind = prisma.userCoins.findUnique as jest.MockedFunction<typeof prisma.userCoins.findUnique>;
const mTxFindMany = prisma.coinTransaction.findMany as jest.MockedFunction<typeof prisma.coinTransaction.findMany>;
const mDiscFindMany = prisma.userDiscount.findMany as jest.MockedFunction<typeof prisma.userDiscount.findMany>;
const mDiscFindFirst = prisma.userDiscount.findFirst as jest.MockedFunction<typeof prisma.userDiscount.findFirst>;
const mDiscCreate = prisma.userDiscount.create as jest.MockedFunction<typeof prisma.userDiscount.create>;
const mReferralFindMany = prisma.referral.findMany as jest.MockedFunction<typeof prisma.referral.findMany>;
const mReferralFindUnique = prisma.referral.findUnique as jest.MockedFunction<typeof prisma.referral.findUnique>;
const mPaymentCount = prisma.payment.count as jest.MockedFunction<typeof prisma.payment.count>;
const mDeviceUpsert = prisma.userDevice.upsert as jest.MockedFunction<typeof prisma.userDevice.upsert>;
const mDeviceUpdateMany = prisma.userDevice.updateMany as jest.MockedFunction<typeof prisma.userDevice.updateMany>;
const mActivityFindMany = prisma.dailyActivity.findMany as jest.MockedFunction<typeof prisma.dailyActivity.findMany>;
const mActivityFindUnique = prisma.dailyActivity.findUnique as jest.MockedFunction<typeof prisma.dailyActivity.findUnique>;
const mActivityUpsert = prisma.dailyActivity.upsert as jest.MockedFunction<typeof prisma.dailyActivity.upsert>;
const mUserFind = prisma.user.findUnique as jest.MockedFunction<typeof prisma.user.findUnique>;
const mSiteConfig = prisma.siteConfig.findUnique as jest.MockedFunction<typeof prisma.siteConfig.findUnique>;
const mTransaction = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;
const mEnsureRef = ensureReferralCode as jest.MockedFunction<typeof ensureReferralCode>;
const mApplyRef = applyReferralCode as jest.MockedFunction<typeof applyReferralCode>;
const mSignedUrl = getSignedFileUrl as jest.MockedFunction<typeof getSignedFileUrl>;

const USER = signToken({ userId: "user-1", email: "u@test.com", role: "user" });

function makeReq(opts: { token?: string; body?: unknown; query?: Record<string, string>; url?: string } = {}) {
  const headers = new Map<string, string>();
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  const params = new URLSearchParams(opts.query || {});
  const url = opts.url || ("http://localhost/api?" + params.toString());
  return {
    json: async () => opts.body ?? {},
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    nextUrl: { searchParams: params },
    url,
  } as never;
}
async function readJson(res: Response) {
  return (res as unknown as { json: () => Promise<Record<string, unknown>> }).json();
}

// ─────────────────────────────────────────────────────────────
// POST /api/feedback
// ─────────────────────────────────────────────────────────────
describe("POST /api/feedback", () => {
  it("401 without a token", async () => {
    const res = await feedback(makeReq({ body: { rating: 5 } }));
    expect(res.status).toBe(401);
  });

  it("400 for an out-of-range rating", async () => {
    const res = await feedback(makeReq({ token: USER, body: { rating: 9 } }));
    expect(res.status).toBe(400);
  });

  it("stores a feedback survey response", async () => {
    mSurveyCreate.mockResolvedValue({ id: "sr1" } as never);
    const res = await feedback(makeReq({ token: USER, body: { rating: 4, feedback: "nice", lessonId: "l1" } }));
    expect(res.status).toBe(200);
    const arg = mSurveyCreate.mock.calls[0][0] as { data: { answers: Record<string, unknown> } };
    expect(arg.data.answers.type).toBe("lesson_rating");
    expect(arg.data.answers.rating).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/mall
// ─────────────────────────────────────────────────────────────
describe("GET /api/mall", () => {
  it("401 without a token", async () => {
    const res = await mall(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("returns balance + offers with availability flags", async () => {
    mCoinsFind.mockResolvedValue({ totalCoins: 300 } as never);
    const res = await mall(makeReq({ token: USER }));
    const body = await readJson(res);
    expect(body.balance).toBe(300);
    const offers = body.offers as Array<Record<string, unknown>>;
    expect(offers.find((o) => o.id === "offer-1")!.available).toBe(true); // 200 <= 300
    expect(offers.find((o) => o.id === "offer-2")!.available).toBe(false); // 500 > 300
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/mall/redeem
// ─────────────────────────────────────────────────────────────
describe("POST /api/mall/redeem", () => {
  it("401 without a token", async () => {
    const res = await mallRedeem(makeReq({ body: { offerId: "offer-1" } }));
    expect(res.status).toBe(401);
  });

  it("400 when neither offerId nor couponCode provided", async () => {
    const res = await mallRedeem(makeReq({ token: USER, body: {} }));
    expect(res.status).toBe(400);
  });

  it("applies a valid discount coupon", async () => {
    mDiscFindFirst.mockResolvedValue(null as never);
    mDiscCreate.mockResolvedValue({ id: "d1", percent: 10 } as never);
    const res = await mallRedeem(makeReq({ token: USER, body: { couponCode: "welcome10" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.coupon as Record<string, unknown>).discount).toBe(10);
  });

  it("returns ready-to-use when coupon already applied", async () => {
    mDiscFindFirst.mockResolvedValue({ id: "d-old", percent: 20 } as never);
    const res = await mallRedeem(makeReq({ token: USER, body: { couponCode: "CODING20" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.discount as Record<string, unknown>).id).toBe("d-old");
  });

  it("falls back to referral code when coupon is unknown", async () => {
    mApplyRef.mockResolvedValue({ ok: true, message: "Referral applied!", coinsAwarded: 50 } as never);
    const res = await mallRedeem(makeReq({ token: USER, body: { couponCode: "FRIEND123" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.referral as Record<string, unknown>).coinsAwarded).toBe(50);
  });

  it("surfaces referral error for an invalid unknown code", async () => {
    mApplyRef.mockResolvedValue({ ok: false, status: 400, message: "Invalid code." } as never);
    const res = await mallRedeem(makeReq({ token: USER, body: { couponCode: "BADCODE" } }));
    expect(res.status).toBe(400);
  });

  it("redeems a coin offer atomically (discount offer)", async () => {
    mCoinsFind.mockResolvedValue({ totalCoins: 600 } as never);
    mTransaction.mockImplementation(async (cb: unknown) => {
      // the route passes an interactive callback; invoke with a fake tx
      const tx = {
        userCoins: { update: jest.fn().mockResolvedValue({}) },
        coinTransaction: { create: jest.fn().mockResolvedValue({}) },
        userDiscount: { create: jest.fn().mockResolvedValue({ id: "disc-1", percent: 25 }) },
      };
      return (cb as (t: unknown) => Promise<unknown>)(tx);
    });
    const res = await mallRedeem(makeReq({ token: USER, body: { offerId: "offer-2" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.newBalance).toBe(100); // 600 - 500 (offer-2 cost)
    expect((body.discount as Record<string, unknown>).percent).toBe(25);
  });

  it("400 for an insufficient-coins offer", async () => {
    mCoinsFind.mockResolvedValue({ totalCoins: 10 } as never);
    const res = await mallRedeem(makeReq({ token: USER, body: { offerId: "offer-1" } }));
    expect(res.status).toBe(400);
  });

  it("400 for an invalid offerId", async () => {
    const res = await mallRedeem(makeReq({ token: USER, body: { offerId: "nope" } }));
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/mall/history
// ─────────────────────────────────────────────────────────────
describe("GET /api/mall/history", () => {
  it("401 without a token", async () => {
    const res = await mallHistory(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("returns transactions with earned/spent totals", async () => {
    mTxFindMany.mockResolvedValue([
      { id: "t1", coins: 10, type: "EARNED", reason: "quiz", createdAt: new Date() },
      { id: "t2", coins: 5, type: "SPENT", reason: "offer", createdAt: new Date() },
    ] as never);
    mCoinsFind.mockResolvedValue({ totalCoins: 5 } as never);
    const res = await mallHistory(makeReq({ token: USER }));
    const body = await readJson(res);
    expect(body.totalEarned).toBe(10);
    expect(body.totalSpent).toBe(5);
    expect(body.balance).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/referral
// ─────────────────────────────────────────────────────────────
describe("GET /api/referral", () => {
  it("401 without a token", async () => {
    const res = await referral(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("returns code + stats (canApply true for a fresh user)", async () => {
    mEnsureRef.mockResolvedValue("ARJU7K2Q" as never);
    mReferralFindMany.mockResolvedValue([{ referrerReward: 50 }, { referrerReward: 50 }] as never);
    mReferralFindUnique.mockResolvedValue(null as never);
    mPaymentCount.mockResolvedValue(0 as never);

    const res = await referral(makeReq({ token: USER }));
    const body = await readJson(res);
    expect(body.code).toBe("ARJU7K2Q");
    expect(body.referredCount).toBe(2);
    expect(body.coinsEarned).toBe(100);
    expect(body.canApply).toBe(true);
  });

  it("canApply false when user already purchased", async () => {
    mEnsureRef.mockResolvedValue("CODE" as never);
    mReferralFindMany.mockResolvedValue([] as never);
    mReferralFindUnique.mockResolvedValue(null as never);
    mPaymentCount.mockResolvedValue(1 as never);
    const res = await referral(makeReq({ token: USER }));
    const body = await readJson(res);
    expect(body.canApply).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/discount
// ─────────────────────────────────────────────────────────────
describe("GET /api/discount", () => {
  it("401 without a token", async () => {
    const res = await discount(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("returns the best (first) discount + full list", async () => {
    mDiscFindMany.mockResolvedValue([
      { id: "d1", percent: 25, label: "25%", source: "offer", code: null, createdAt: new Date() },
      { id: "d2", percent: 10, label: "10%", source: "coupon", code: "W10", createdAt: new Date() },
    ] as never);
    const res = await discount(makeReq({ token: USER }));
    const body = await readJson(res);
    expect((body.discount as Record<string, unknown>).id).toBe("d1");
    expect((body.discounts as unknown[]).length).toBe(2);
  });

  it("returns null discount when none exist", async () => {
    mDiscFindMany.mockResolvedValue([] as never);
    const res = await discount(makeReq({ token: USER }));
    const body = await readJson(res);
    expect(body.discount).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/health  &  GET /api/app-config  (public)
// ─────────────────────────────────────────────────────────────
describe("public config endpoints", () => {
  it("health returns ok status", async () => {
    const res = await health();
    const body = await readJson(res);
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("number");
  });

  it("app-config returns support contacts (digits-only whatsapp)", async () => {
    const res = await appConfig();
    const body = await readJson(res);
    expect(typeof body.supportWhatsapp).toBe("string");
    expect(body.supportWhatsapp).toMatch(/^\d+$/);
    expect(typeof body.supportEmail).toBe("string");
  });
});

// ─────────────────────────────────────────────────────────────
// POST / DELETE /api/devices/register
// ─────────────────────────────────────────────────────────────
describe("devices/register", () => {
  it("401 without a token", async () => {
    const res = await deviceRegister(makeReq({ body: { platform: "android", deviceId: "d1" } }));
    expect(res.status).toBe(401);
  });

  it("400 when platform or deviceId missing", async () => {
    const res = await deviceRegister(makeReq({ token: USER, body: { platform: "android" } }));
    expect(res.status).toBe(400);
  });

  it("400 for an invalid platform", async () => {
    const res = await deviceRegister(makeReq({ token: USER, body: { platform: "watch", deviceId: "d1" } }));
    expect(res.status).toBe(400);
  });

  it("upserts a device on valid registration", async () => {
    mDeviceUpsert.mockResolvedValue({ id: "dev-1" } as never);
    const res = await deviceRegister(makeReq({ token: USER, body: { platform: "android", deviceId: "d1", pushToken: "tok" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.registered).toBe(true);
  });

  it("DELETE deactivates a device", async () => {
    mDeviceUpdateMany.mockResolvedValue({ count: 1 } as never);
    const res = await deviceDelete(makeReq({ token: USER, body: { deviceId: "d1" } }));
    const body = await readJson(res);
    expect(body.deactivated).toBe(true);
  });

  it("DELETE 400 without deviceId", async () => {
    const res = await deviceDelete(makeReq({ token: USER, body: {} }));
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// GET / POST /api/attendance
// ─────────────────────────────────────────────────────────────
describe("attendance", () => {
  it("GET 401 without a token", async () => {
    const res = await attendanceGet(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("GET returns joinedAt + activity days", async () => {
    mActivityFindMany.mockResolvedValue([{ date: "2025-01-01", minutes: 30, sessions: 2 }] as never);
    mUserFind.mockResolvedValue({ createdAt: new Date("2024-12-01T00:00:00Z") } as never);
    const res = await attendanceGet(makeReq({ token: USER, url: "http://localhost/api/attendance?from=2024-12-01&to=2025-02-01" }));
    const body = await readJson(res);
    expect(body.joinedAt).toBe("2024-12-01");
    expect((body.days as unknown[]).length).toBe(1);
  });

  it("POST 400 for a bad date", async () => {
    const res = await attendancePost(makeReq({ token: USER, body: { date: "01-01-2025", minutes: 5 } }));
    expect(res.status).toBe(400);
  });

  it("POST skips when nothing to record", async () => {
    const res = await attendancePost(makeReq({ token: USER, body: { date: "2025-01-01", minutes: 0, sessions: 0 } }));
    const body = await readJson(res);
    expect(body.skipped).toBe(true);
  });

  it("POST accumulates minutes onto the existing day (capped)", async () => {
    mActivityFindUnique.mockResolvedValue({ minutes: 20, sessions: 1 } as never);
    mActivityUpsert.mockResolvedValue({ date: "2025-01-01", minutes: 50, sessions: 2 } as never);
    const res = await attendancePost(makeReq({ token: USER, body: { date: "2025-01-01", minutes: 30, sessions: 1 } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    const arg = mActivityUpsert.mock.calls[0][0] as { update: { minutes: number } };
    expect(arg.update.minutes).toBe(50); // 20 + 30
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/demo-video  (public)
// ─────────────────────────────────────────────────────────────
describe("GET /api/demo-video", () => {
  it("404 when no demo video configured", async () => {
    mSiteConfig.mockResolvedValue(null as never);
    const res = await demoVideo();
    expect(res.status).toBe(404);
  });

  it("returns a signed url when configured", async () => {
    mSiteConfig.mockResolvedValue({ key: "demo_video_s3_key", value: "videos/demo.mp4" } as never);
    mSignedUrl.mockResolvedValue("https://signed.example/demo.mp4" as never);
    const res = await demoVideo();
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.url).toContain("signed");
  });
});
