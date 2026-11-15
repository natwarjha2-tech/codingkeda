/**
 * Unit tests — Student / Content API routes (Phase 6)
 *   • GET  /api/achievements
 *   • GET  /api/coins
 *   • POST /api/coins/redeem
 *   • GET  /api/leaderboard
 *   • POST /api/notifications        (sync / unread-count / mark-read / mark-all-read / delete / clear-all)
 *   • GET/POST /api/weekly-streak
 *   • GET  /api/homework
 *   • GET/POST /api/quiz
 *
 * FULLY MOCKED — prisma, the notification helper module, gemini and the
 * quiz-leaderboard service are all mocked. Auth is REAL (valid JWTs signed with
 * a test-only secret) so middleware is genuinely exercised. No real DB / AI /
 * network is ever touched — zero production side effects.
 */

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-only-jwt-secret-value-0123456789-abcdef";
}

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    achievement: { count: jest.fn(), findMany: jest.fn() },
    lesson: { findMany: jest.fn(), findUnique: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    quizAttempt: { findMany: jest.fn(), create: jest.fn() },
    userCoins: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    coinTransaction: { findMany: jest.fn(), create: jest.fn() },
    course: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    quiz: { findMany: jest.fn(), findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn() },
    homework: { findMany: jest.fn() },
    weeklyStreak: { findUnique: jest.fn(), findMany: jest.fn() },
    weeklyStreakAttempt: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/app/lib/notification", () => ({
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  clearAllNotifications: jest.fn(),
  notifyCoinsSpent: jest.fn().mockResolvedValue(undefined),
  notifyWeeklyStreak: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/lib/gemini", () => ({
  callGeminiJSON: jest.fn(),
  isGeminiConfigured: jest.fn(() => false),
}));

jest.mock("@/app/services/quiz-leaderboard.service", () => ({
  recalculateAndAwardCoins: jest.fn(),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET as getAchievements } from "@/app/api/achievements/route";
import { GET as getCoins } from "@/app/api/coins/route";
import { POST as redeemCoins } from "@/app/api/coins/redeem/route";
import { GET as getLeaderboard } from "@/app/api/leaderboard/route";
import { POST as notifications } from "@/app/api/notifications/route";
import { GET as getStreak, POST as submitStreak } from "@/app/api/weekly-streak/route";
import { GET as getHomework } from "@/app/api/homework/route";
import { GET as getQuiz, POST as submitQuiz } from "@/app/api/quiz/route";

import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import * as notif from "@/app/lib/notification";
import { callGeminiJSON, isGeminiConfigured } from "@/app/lib/gemini";
import { recalculateAndAwardCoins } from "@/app/services/quiz-leaderboard.service";

// Typed mock helpers
const mAchCount = prisma.achievement.count as jest.MockedFunction<typeof prisma.achievement.count>;
const mAchFindMany = prisma.achievement.findMany as jest.MockedFunction<typeof prisma.achievement.findMany>;
const mLessonFindMany = prisma.lesson.findMany as jest.MockedFunction<typeof prisma.lesson.findMany>;
const mLessonFindUnique = prisma.lesson.findUnique as jest.MockedFunction<typeof prisma.lesson.findUnique>;
const mUserFindMany = prisma.user.findMany as jest.MockedFunction<typeof prisma.user.findMany>;
const mUserFindUnique = prisma.user.findUnique as jest.MockedFunction<typeof prisma.user.findUnique>;
const mAttemptFindMany = prisma.quizAttempt.findMany as jest.MockedFunction<typeof prisma.quizAttempt.findMany>;
const mAttemptCreate = prisma.quizAttempt.create as jest.MockedFunction<typeof prisma.quizAttempt.create>;
const mCoinsFind = prisma.userCoins.findUnique as jest.MockedFunction<typeof prisma.userCoins.findUnique>;
const mCoinsCreate = prisma.userCoins.create as jest.MockedFunction<typeof prisma.userCoins.create>;
const mTxFindMany = prisma.coinTransaction.findMany as jest.MockedFunction<typeof prisma.coinTransaction.findMany>;
const mCourseFindUnique = prisma.course.findUnique as jest.MockedFunction<typeof prisma.course.findUnique>;
const mCourseFindFirst = prisma.course.findFirst as jest.MockedFunction<typeof prisma.course.findFirst>;
const mCourseFindMany = prisma.course.findMany as jest.MockedFunction<typeof prisma.course.findMany>;
const mQuizFindMany = prisma.quiz.findMany as jest.MockedFunction<typeof prisma.quiz.findMany>;
const mQuizFindUnique = prisma.quiz.findUnique as jest.MockedFunction<typeof prisma.quiz.findUnique>;
const mEnrollFind = prisma.enrollment.findUnique as jest.MockedFunction<typeof prisma.enrollment.findUnique>;
const mHomeworkFindMany = prisma.homework.findMany as jest.MockedFunction<typeof prisma.homework.findMany>;
const mStreakFind = prisma.weeklyStreak.findUnique as jest.MockedFunction<typeof prisma.weeklyStreak.findUnique>;
const mStreakFindMany = prisma.weeklyStreak.findMany as jest.MockedFunction<typeof prisma.weeklyStreak.findMany>;
const mStreakAttemptFirst = prisma.weeklyStreakAttempt.findFirst as jest.MockedFunction<typeof prisma.weeklyStreakAttempt.findFirst>;
const mStreakAttemptMany = prisma.weeklyStreakAttempt.findMany as jest.MockedFunction<typeof prisma.weeklyStreakAttempt.findMany>;
const mStreakAttemptCreate = prisma.weeklyStreakAttempt.create as jest.MockedFunction<typeof prisma.weeklyStreakAttempt.create>;
const mTransaction = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;

const mGetNotifs = notif.getNotifications as jest.MockedFunction<typeof notif.getNotifications>;
const mUnread = notif.getUnreadCount as jest.MockedFunction<typeof notif.getUnreadCount>;
const mMarkRead = notif.markAsRead as jest.MockedFunction<typeof notif.markAsRead>;
const mMarkAll = notif.markAllAsRead as jest.MockedFunction<typeof notif.markAllAsRead>;
const mDeleteNotif = notif.deleteNotification as jest.MockedFunction<typeof notif.deleteNotification>;
const mClearAll = notif.clearAllNotifications as jest.MockedFunction<typeof notif.clearAllNotifications>;
const mGeminiJSON = callGeminiJSON as jest.MockedFunction<typeof callGeminiJSON>;
const mGeminiCfg = isGeminiConfigured as jest.MockedFunction<typeof isGeminiConfigured>;
const mRecalc = recalculateAndAwardCoins as jest.MockedFunction<typeof recalculateAndAwardCoins>;

const USER = signToken({ userId: "user-1", email: "u@test.com", role: "user" });

function makeReq(opts: { token?: string; body?: unknown; query?: Record<string, string> } = {}) {
  const headers = new Map<string, string>();
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  const params = new URLSearchParams(opts.query || {});
  return {
    json: async () => opts.body ?? {},
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    nextUrl: { searchParams: params },
  } as never;
}
async function readJson(res: Response) {
  return (res as unknown as { json: () => Promise<Record<string, unknown>> }).json();
}

beforeEach(() => {
  mGeminiCfg.mockReturnValue(false);
  (notif.notifyCoinsSpent as jest.Mock).mockResolvedValue(undefined);
  (notif.notifyWeeklyStreak as jest.Mock).mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────
// GET /api/achievements
// ─────────────────────────────────────────────────────────────
describe("GET /api/achievements", () => {
  it("401 without a token", async () => {
    const res = await getAchievements(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("returns an empty list when the user has no achievements", async () => {
    mAchCount.mockResolvedValue(0 as never);
    const res = await getAchievements(makeReq({ token: USER }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.achievements).toEqual([]);
    expect(body.totalCount).toBe(0);
  });

  it("builds certificate data with quiz score and rank", async () => {
    mAchCount.mockResolvedValue(1 as never);
    mAchFindMany.mockResolvedValue([
      { id: "a1", title: "Master!", badgeType: "master", lessonId: "l1", createdAt: new Date() },
    ] as never);
    mLessonFindMany.mockResolvedValue([
      { id: "l1", title: "Loops", module: { title: "Basics", course: { id: "c1", title: "Py", instructor: "Rao", institute: "IIT", createdBy: "admin-1" } } },
    ] as never);
    mUserFindMany.mockResolvedValue([{ id: "admin-1", name: "Admin", email: "a@test.com" }] as never);
    mUserFindUnique.mockResolvedValue({ name: "Stud", email: "s@test.com" } as never);
    mAttemptFindMany.mockResolvedValue([
      { lessonId: "l1", correct: true },
      { lessonId: "l1", correct: false },
    ] as never);

    const res = await getAchievements(makeReq({ token: USER }));
    const body = await readJson(res);
    const achs = body.achievements as Array<Record<string, unknown>>;
    expect(achs[0].courseTitle).toBe("Py");
    expect(achs[0].score).toBe(50); // 1/2 correct
    expect(achs[0].rank).toBe(2); // master → 2
    expect(achs[0].studentName).toBe("Stud");
  });

  it("supports pagination params", async () => {
    mAchCount.mockResolvedValue(5 as never);
    mAchFindMany.mockResolvedValue([] as never);
    mLessonFindMany.mockResolvedValue([] as never);
    mUserFindMany.mockResolvedValue([] as never);
    mUserFindUnique.mockResolvedValue({ name: "Stud" } as never);
    mAttemptFindMany.mockResolvedValue([] as never);

    const res = await getAchievements(makeReq({ token: USER, query: { page: "2", limit: "2" } }));
    const body = await readJson(res);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(2);
    expect(body.totalPages).toBe(3); // ceil(5/2)
  });

  it("500 when the DB throws", async () => {
    mAchCount.mockRejectedValue(new Error("db down"));
    const res = await getAchievements(makeReq({ token: USER }));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/coins
// ─────────────────────────────────────────────────────────────
describe("GET /api/coins", () => {
  it("401 without a token", async () => {
    const res = await getCoins(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("auto-creates a UserCoins record on first access", async () => {
    mCoinsFind.mockResolvedValue(null as never);
    mCoinsCreate.mockResolvedValue({ userId: "user-1", totalCoins: 0 } as never);
    mTxFindMany.mockResolvedValue([] as never);
    mAchFindMany.mockResolvedValue([] as never);

    const res = await getCoins(makeReq({ token: USER }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(mCoinsCreate).toHaveBeenCalled();
    expect(body.totalCoins).toBe(0);
  });

  it("resolves course/module/lesson titles for transactions", async () => {
    mCoinsFind.mockResolvedValue({ userId: "user-1", totalCoins: 150 } as never);
    mTxFindMany.mockResolvedValue([
      { id: "t1", type: "EARNED", coins: 10, reason: "quiz", createdAt: new Date(), lessonId: "l1", courseId: "c1" },
    ] as never);
    mLessonFindMany.mockResolvedValue([
      { id: "l1", title: "Loops", module: { title: "Basics", courseId: "c1" } },
    ] as never);
    mCourseFindMany.mockResolvedValue([{ id: "c1", title: "Python" }] as never);
    mAchFindMany.mockResolvedValue([] as never);

    const res = await getCoins(makeReq({ token: USER }));
    const body = await readJson(res);
    expect(body.totalCoins).toBe(150);
    const txs = body.transactions as Array<Record<string, unknown>>;
    expect(txs[0].courseTitle).toBe("Python");
    expect(txs[0].lessonTitle).toBe("Loops");
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/coins/redeem
// ─────────────────────────────────────────────────────────────
describe("POST /api/coins/redeem", () => {
  it("401 without a token", async () => {
    const res = await redeemCoins(makeReq({ body: { courseId: "c1", coinsToRedeem: 100 } }));
    expect(res.status).toBe(401);
  });

  it("400 when below the 100-coin minimum", async () => {
    const res = await redeemCoins(makeReq({ token: USER, body: { courseId: "c1", coinsToRedeem: 50 } }));
    expect(res.status).toBe(400);
  });

  it("400 on insufficient coins", async () => {
    mCoinsFind.mockResolvedValue({ totalCoins: 50 } as never);
    const res = await redeemCoins(makeReq({ token: USER, body: { courseId: "c1", coinsToRedeem: 100 } }));
    expect(res.status).toBe(400);
  });

  it("404 when the course does not exist", async () => {
    mCoinsFind.mockResolvedValue({ totalCoins: 500 } as never);
    mCourseFindUnique.mockResolvedValue(null as never);
    const res = await redeemCoins(makeReq({ token: USER, body: { courseId: "c1", coinsToRedeem: 100 } }));
    expect(res.status).toBe(404);
  });

  it("redeems coins atomically and returns discount", async () => {
    mCoinsFind.mockResolvedValue({ totalCoins: 500 } as never);
    mCourseFindUnique.mockResolvedValue({ id: "c1", title: "Python" } as never);
    mTransaction.mockResolvedValue([{ totalCoins: 400 }, { id: "tx1" }] as never);

    const res = await redeemCoins(makeReq({ token: USER, body: { courseId: "c1", coinsToRedeem: 100 } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.discount).toBe(100);
    expect(body.remainingCoins).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/leaderboard
// ─────────────────────────────────────────────────────────────
describe("GET /api/leaderboard", () => {
  it("400 when neither courseId nor lessonId is given", async () => {
    const res = await getLeaderboard(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns an empty leaderboard when no attempts exist", async () => {
    mAttemptFindMany.mockResolvedValue([] as never);
    const res = await getLeaderboard(makeReq({ query: { courseId: "c1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.leaderboard).toEqual([]);
    expect(body.totalStudents).toBe(0);
  });

  it("ranks users by score and flags the current user", async () => {
    mAttemptFindMany.mockResolvedValue([
      { userId: "user-1", correct: true, createdAt: new Date(1000), timeTaken: 5 },
      { userId: "user-1", correct: true, createdAt: new Date(1200), timeTaken: 5 },
      { userId: "user-2", correct: true, createdAt: new Date(900), timeTaken: 3 },
      { userId: "user-2", correct: false, createdAt: new Date(950), timeTaken: 3 },
    ] as never);
    mUserFindMany.mockResolvedValue([
      { id: "user-1", name: "Alice" },
      { id: "user-2", name: "Bob" },
    ] as never);

    const res = await getLeaderboard(makeReq({ token: USER, query: { lessonId: "l1" } }));
    const body = await readJson(res);
    const lb = body.leaderboard as Array<Record<string, unknown>>;
    // user-1 has 100% (2/2), user-2 has 50% → user-1 rank 1
    expect(lb[0].name).toBe("Alice");
    expect(lb[0].score).toBe(100);
    expect(lb[0].isCurrentUser).toBe(true);
    expect((body.currentUserRank as Record<string, unknown>).rank).toBe(1);
  });

  it("falls back to Quiz→Lesson lookup when direct attempts are empty", async () => {
    mAttemptFindMany
      .mockResolvedValueOnce([] as never) // direct lesson query empty
      .mockResolvedValueOnce([{ userId: "user-2", correct: true, createdAt: new Date(1), timeTaken: 1 }] as never);
    mQuizFindMany.mockResolvedValue([{ id: "q1" }] as never);
    mUserFindMany.mockResolvedValue([{ id: "user-2", name: "Bob" }] as never);

    const res = await getLeaderboard(makeReq({ query: { lessonId: "l1" } }));
    const body = await readJson(res);
    expect((body.leaderboard as unknown[]).length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/notifications
// ─────────────────────────────────────────────────────────────
describe("POST /api/notifications", () => {
  it("401 without a token", async () => {
    const res = await notifications(makeReq({ body: { action: "unread-count" } }));
    expect(res.status).toBe(401);
  });

  it("400 when action is missing", async () => {
    const res = await notifications(makeReq({ token: USER, body: {} }));
    expect(res.status).toBe(400);
  });

  it("400 on an unknown action", async () => {
    const res = await notifications(makeReq({ token: USER, body: { action: "nope" } }));
    expect(res.status).toBe(400);
  });

  it("sync returns notifications", async () => {
    mGetNotifs.mockResolvedValue({ notifications: [{ id: "n1" }], nextCursor: null } as never);
    const res = await notifications(makeReq({ token: USER, body: { action: "sync", limit: 10 } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.notifications as unknown[]).length).toBe(1);
  });

  it("unread-count returns the count", async () => {
    mUnread.mockResolvedValue(3 as never);
    const res = await notifications(makeReq({ token: USER, body: { action: "unread-count" } }));
    const body = await readJson(res);
    expect(body.unreadCount).toBe(3);
  });

  it("mark-read 400 when id is missing", async () => {
    const res = await notifications(makeReq({ token: USER, body: { action: "mark-read" } }));
    expect(res.status).toBe(400);
  });

  it("mark-read marks a notification", async () => {
    mMarkRead.mockResolvedValue(true as never);
    const res = await notifications(makeReq({ token: USER, body: { action: "mark-read", id: "n1" } }));
    const body = await readJson(res);
    expect(body.success).toBe(true);
  });

  it("mark-all-read returns the count", async () => {
    mMarkAll.mockResolvedValue(5 as never);
    const res = await notifications(makeReq({ token: USER, body: { action: "mark-all-read" } }));
    const body = await readJson(res);
    expect(body.count).toBe(5);
  });

  it("delete 400 when id is missing", async () => {
    const res = await notifications(makeReq({ token: USER, body: { action: "delete" } }));
    expect(res.status).toBe(400);
  });

  it("delete removes a notification", async () => {
    mDeleteNotif.mockResolvedValue(true as never);
    const res = await notifications(makeReq({ token: USER, body: { action: "delete", id: "n1" } }));
    const body = await readJson(res);
    expect(body.success).toBe(true);
  });

  it("clear-all removes everything", async () => {
    mClearAll.mockResolvedValue(7 as never);
    const res = await notifications(makeReq({ token: USER, body: { action: "clear-all" } }));
    const body = await readJson(res);
    expect(body.count).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────
// GET / POST /api/weekly-streak
// ─────────────────────────────────────────────────────────────
describe("GET /api/weekly-streak", () => {
  it("400 when neither lessonId nor courseId is given", async () => {
    const res = await getStreak(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns a single streak for a lessonId", async () => {
    mStreakFind.mockResolvedValue({ id: "s1", title: "Week 1" } as never);
    const res = await getStreak(makeReq({ query: { lessonId: "l1" } }));
    const body = await readJson(res);
    expect((body.streak as Record<string, unknown>).id).toBe("s1");
  });

  it("returns course streaks with completion flags for an authed user", async () => {
    mStreakFindMany.mockResolvedValue([
      { id: "s1", title: "W1", weekNumber: 1 },
      { id: "s2", title: "W2", weekNumber: 2 },
    ] as never);
    mStreakAttemptMany.mockResolvedValue([{ streakId: "s1", passed: true }] as never);

    const res = await getStreak(makeReq({ token: USER, query: { courseId: "c1" } }));
    const body = await readJson(res);
    expect(body.completedCount).toBe(1);
    const streaks = body.streaks as Array<Record<string, unknown>>;
    expect(streaks[0].completed).toBe(true);
    expect(streaks[1].completed).toBe(false);
  });
});

describe("POST /api/weekly-streak", () => {
  it("401 without a token", async () => {
    const res = await submitStreak(makeReq({ body: { streakId: "s1", answer: "hello world" } }));
    expect(res.status).toBe(401);
  });

  it("400 when streakId or answer is missing", async () => {
    const res = await submitStreak(makeReq({ token: USER, body: { streakId: "s1" } }));
    expect(res.status).toBe(400);
  });

  it("404 when the streak does not exist", async () => {
    mStreakFind.mockResolvedValue(null as never);
    const res = await submitStreak(makeReq({ token: USER, body: { streakId: "s1", answer: "my answer here" } }));
    expect(res.status).toBe(404);
  });

  it("returns already-completed when a passing attempt exists", async () => {
    mStreakFind.mockResolvedValue({ id: "s1", title: "W1" } as never);
    mStreakAttemptFirst.mockResolvedValue({ id: "att-old" } as never);
    const res = await submitStreak(makeReq({ token: USER, body: { streakId: "s1", answer: "my answer here" } }));
    const body = await readJson(res);
    expect(body.passed).toBe(true);
    expect(body.attemptId).toBe("att-old");
  });

  it("falls back to length heuristic when Gemini is not configured", async () => {
    mGeminiCfg.mockReturnValue(false);
    mStreakFind.mockResolvedValue({ id: "s1", title: "W1", courseId: "c1", weekNumber: 1 } as never);
    mStreakAttemptFirst.mockResolvedValue(null as never);
    mStreakAttemptCreate.mockResolvedValue({ id: "att-1" } as never);
    mCourseFindFirst.mockResolvedValue({ title: "Py" } as never);

    const res = await submitStreak(makeReq({ token: USER, body: { streakId: "s1", answer: "a sufficiently long answer" } }));
    const body = await readJson(res);
    expect(body.passed).toBe(true); // length >= 10
    expect(body.attemptId).toBe("att-1");
  });

  it("uses Gemini verdict when configured", async () => {
    mGeminiCfg.mockReturnValue(true);
    mGeminiJSON.mockResolvedValue({ passed: false, feedback: "Try again" } as never);
    mStreakFind.mockResolvedValue({ id: "s1", title: "W1", courseId: "c1", weekNumber: 1, problem: "p", solution: "s" } as never);
    mStreakAttemptFirst.mockResolvedValue(null as never);
    mStreakAttemptCreate.mockResolvedValue({ id: "att-2" } as never);

    const res = await submitStreak(makeReq({ token: USER, body: { streakId: "s1", answer: "wrong attempt" } }));
    const body = await readJson(res);
    expect(body.passed).toBe(false);
    expect(body.feedback).toBe("Try again");
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/homework
// ─────────────────────────────────────────────────────────────
describe("GET /api/homework", () => {
  it("400 when lessonId is missing", async () => {
    const res = await getHomework(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns homework problems for a lesson", async () => {
    mHomeworkFindMany.mockResolvedValue([{ id: "hw1", title: "HW", order: 1 }] as never);
    const res = await getHomework(makeReq({ query: { lessonId: "l1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.homeworks as unknown[]).length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// GET / POST /api/quiz
// ─────────────────────────────────────────────────────────────
describe("GET /api/quiz", () => {
  it("400 when lessonId is missing", async () => {
    const res = await getQuiz(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns quizzes (anonymous — no attempt state)", async () => {
    mQuizFindMany.mockResolvedValue([{ id: "q1", question: "Q?" }] as never);
    const res = await getQuiz(makeReq({ query: { lessonId: "l1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.attempted).toBe(false);
  });

  it("returns quizzes with attempt state for an authed user", async () => {
    mQuizFindMany.mockResolvedValue([{ id: "q1" }] as never);
    mAttemptFindMany.mockResolvedValue([{ quizId: "q1" }] as never);
    const res = await getQuiz(makeReq({ token: USER, query: { lessonId: "l1" } }));
    const body = await readJson(res);
    expect(body.attempted).toBe(true);
    expect(body.attemptedQuizIds).toEqual(["q1"]);
  });
});

describe("POST /api/quiz", () => {
  const body = { quizId: "q1", selected: 1, courseId: "c1", lessonId: "l1" };

  it("401 without a token", async () => {
    const res = await submitQuiz(makeReq({ body }));
    expect(res.status).toBe(401);
  });

  it("400 when required fields are missing", async () => {
    const res = await submitQuiz(makeReq({ token: USER, body: { quizId: "q1" } }));
    expect(res.status).toBe(400);
  });

  it("404 when the quiz is not found", async () => {
    mQuizFindUnique.mockResolvedValue(null as never);
    const res = await submitQuiz(makeReq({ token: USER, body }));
    expect(res.status).toBe(404);
  });

  it("403 when the user is not enrolled and lesson is not free", async () => {
    mQuizFindUnique.mockResolvedValue({ id: "q1", answer: 1, lessonId: "l1", lesson: { isFree: false } } as never);
    mEnrollFind.mockResolvedValue(null as never);
    const res = await submitQuiz(makeReq({ token: USER, body }));
    expect(res.status).toBe(403);
  });

  it("records a correct attempt and awards coins (enrolled)", async () => {
    mQuizFindUnique.mockResolvedValue({ id: "q1", answer: 1, explanation: "because", lessonId: "l1", lesson: { isFree: false } } as never);
    mEnrollFind.mockResolvedValue({ userId: "user-1", courseId: "c1" } as never);
    mAttemptCreate.mockResolvedValue({ id: "att-1" } as never);
    mRecalc.mockResolvedValue({ coinsAwarded: 10, badge: "super-master", rank: 1 } as never);

    const res = await submitQuiz(makeReq({ token: USER, body }));
    const resBody = await readJson(res);
    expect(res.status).toBe(200);
    expect(resBody.correct).toBe(true);
    expect(resBody.coinsAwarded).toBe(10);
    expect(resBody.rank).toBe(1);
  });

  it("allows a free lesson without enrollment and marks wrong answer", async () => {
    mQuizFindUnique.mockResolvedValue({ id: "q1", answer: 2, lessonId: "l1", lesson: { isFree: true } } as never);
    mAttemptCreate.mockResolvedValue({ id: "att-2" } as never);
    mRecalc.mockResolvedValue({ coinsAwarded: 0, badge: null, rank: null } as never);

    const res = await submitQuiz(makeReq({ token: USER, body }));
    const resBody = await readJson(res);
    expect(res.status).toBe(200);
    expect(resBody.correct).toBe(false); // selected 1 != answer 2
    expect(mEnrollFind).not.toHaveBeenCalled();
  });
});
