/**
 * Unit tests — notification service (app/lib/notification.ts) [Phase 7, batch B]
 *   • createNotification — happy path, outbox, duplicate (P2002 + message), rethrow
 *   • getNotifications / getUnreadCount — cursor + unread count
 *   • markAsRead / markAllAsRead / deleteNotification / clearAllNotifications
 *   • event wrappers — notifyCourseEnrolled, notifyPaymentFailed, notifyAchievement,
 *                       notifyCoinsEarned, notifyWeeklyStreak, notifyLeaderboardWinner
 *
 * FULLY MOCKED — only prisma is mocked. No real DB is ever touched.
 */

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    notificationOutbox: { create: jest.fn() },
    lesson: { findUnique: jest.fn() },
  },
}));

import { prisma } from "@/app/lib/prisma";
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  notifyCourseEnrolled,
  notifyPaymentFailed,
  notifyAchievement,
  notifyCoinsEarned,
  notifyWeeklyStreak,
  notifyLeaderboardWinner,
} from "@/app/lib/notification";

const mCreate = prisma.notification.create as jest.MockedFunction<typeof prisma.notification.create>;
const mFindMany = prisma.notification.findMany as jest.MockedFunction<typeof prisma.notification.findMany>;
const mCount = prisma.notification.count as jest.MockedFunction<typeof prisma.notification.count>;
const mUpdateMany = prisma.notification.updateMany as jest.MockedFunction<typeof prisma.notification.updateMany>;
const mDeleteMany = prisma.notification.deleteMany as jest.MockedFunction<typeof prisma.notification.deleteMany>;
const mOutboxCreate = prisma.notificationOutbox.create as jest.MockedFunction<typeof prisma.notificationOutbox.create>;
const mLessonFind = prisma.lesson.findUnique as jest.MockedFunction<typeof prisma.lesson.findUnique>;

const baseInput = {
  userId: "u1",
  type: "test",
  category: "system",
  title: "T",
  body: "B",
  idempotencyKey: "k1",
};

describe("createNotification", () => {
  it("creates the notification + outbox entry on the happy path", async () => {
    mCreate.mockResolvedValue({ id: "n1" } as never);
    mOutboxCreate.mockResolvedValue({ id: "o1" } as never);

    const res = await createNotification(baseInput as never);
    expect(res).toEqual({ id: "n1" });
    expect(mOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notificationId: "n1", status: "pending" }) })
    );
  });

  it("still returns the notification when outbox creation fails", async () => {
    mCreate.mockResolvedValue({ id: "n2" } as never);
    mOutboxCreate.mockRejectedValue(new Error("outbox down"));
    const res = await createNotification(baseInput as never);
    expect(res).toEqual({ id: "n2" });
  });

  it("returns null on a P2002 duplicate", async () => {
    mCreate.mockRejectedValue({ code: "P2002" });
    const res = await createNotification(baseInput as never);
    expect(res).toBeNull();
  });

  it("returns null on a 'Unique constraint' message error", async () => {
    mCreate.mockRejectedValue(new Error("Unique constraint failed"));
    const res = await createNotification(baseInput as never);
    expect(res).toBeNull();
  });

  it("rethrows unexpected errors", async () => {
    mCreate.mockRejectedValue(new Error("db exploded"));
    await expect(createNotification(baseInput as never)).rejects.toThrow("db exploded");
  });
});

describe("getNotifications / getUnreadCount", () => {
  it("returns items + unread count, nextCursor null when under the limit", async () => {
    mFindMany.mockResolvedValue([{ id: "n1", createdAt: new Date() }] as never);
    mCount.mockResolvedValue(3 as never);
    const res = await getNotifications("u1", { limit: 30 });
    expect(res.items.length).toBe(1);
    expect(res.unreadCount).toBe(3);
    expect(res.nextCursor).toBeNull();
  });

  it("sets nextCursor when the page is full", async () => {
    const last = new Date("2025-01-01T00:00:00Z");
    const items = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, createdAt: i === 29 ? last : new Date() }));
    mFindMany.mockResolvedValue(items as never);
    mCount.mockResolvedValue(0 as never);
    const res = await getNotifications("u1", { limit: 30, after: "2024-01-01T00:00:00Z" });
    expect(res.nextCursor).toBe(last.toISOString());
  });

  it("getUnreadCount delegates to prisma count", async () => {
    mCount.mockResolvedValue(7 as never);
    expect(await getUnreadCount("u1")).toBe(7);
  });
});

describe("read / delete helpers", () => {
  it("markAsRead returns true when a row was updated", async () => {
    mUpdateMany.mockResolvedValue({ count: 1 } as never);
    expect(await markAsRead("u1", "n1")).toBe(true);
  });

  it("markAsRead returns false when nothing matched", async () => {
    mUpdateMany.mockResolvedValue({ count: 0 } as never);
    expect(await markAsRead("u1", "n1")).toBe(false);
  });

  it("markAllAsRead returns the updated count", async () => {
    mUpdateMany.mockResolvedValue({ count: 5 } as never);
    expect(await markAllAsRead("u1")).toBe(5);
  });

  it("deleteNotification returns true when a row was removed", async () => {
    mDeleteMany.mockResolvedValue({ count: 1 } as never);
    expect(await deleteNotification("u1", "n1")).toBe(true);
  });

  it("clearAllNotifications returns the deleted count", async () => {
    mDeleteMany.mockResolvedValue({ count: 9 } as never);
    expect(await clearAllNotifications("u1")).toBe(9);
  });
});

describe("event wrappers", () => {
  beforeEach(() => {
    mCreate.mockResolvedValue({ id: "n-evt" } as never);
    mOutboxCreate.mockResolvedValue({ id: "o" } as never);
  });

  it("notifyCourseEnrolled builds a payment-category HIGH notification", async () => {
    await notifyCourseEnrolled({ userId: "u1", courseId: "c1", courseName: "Py" });
    const arg = mCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.type).toBe("course_enrolled");
    expect(arg.data.priority).toBe("HIGH");
    expect(arg.data.idempotencyKey).toBe("course_enrolled:u1:c1");
  });

  it("notifyPaymentFailed keys on the orderId", async () => {
    await notifyPaymentFailed({ userId: "u1", courseId: "c1", courseName: "Py", orderId: "ord_9" });
    const arg = mCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.idempotencyKey).toBe("payment_failed:ord_9");
  });

  it("notifyAchievement resolves the course/module/lesson breadcrumb", async () => {
    mLessonFind.mockResolvedValue({
      title: "Loops",
      module: { title: "Basics", course: { title: "Python" } },
    } as never);
    await notifyAchievement({ userId: "u1", title: "Master", badgeType: "master", lessonId: "l1", courseId: "c1" });
    const arg = mCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.body).toContain("Python › Basics › Loops");
  });

  it("notifyAchievement falls back to a generic body when the lookup fails", async () => {
    mLessonFind.mockRejectedValue(new Error("db down"));
    await notifyAchievement({ userId: "u1", title: "Master", badgeType: "master", lessonId: "l1" });
    const arg = mCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.body).toContain('earned the "Master" achievement');
  });

  it("notifyCoinsEarned prefixes the idempotency key", async () => {
    await notifyCoinsEarned({ userId: "u1", coins: 10, reason: "quiz", idempotencyKey: "src-1" });
    const arg = mCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.idempotencyKey).toBe("coins_earned:src-1");
    expect(arg.data.title).toContain("+10");
  });

  it("notifyWeeklyStreak includes the week number", async () => {
    await notifyWeeklyStreak({ userId: "u1", streakId: "s1", courseName: "Py", weekNumber: 3 });
    const arg = mCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.body).toContain("3-week streak");
  });

  it("notifyLeaderboardWinner builds a ranked body", async () => {
    await notifyLeaderboardWinner({ userId: "u1", problemId: "p1", problemTitle: "Two Sum", rank: 1, coinsAwarded: 10 });
    const arg = mCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.title).toContain("#1");
    expect(arg.data.idempotencyKey).toBe("leaderboard:p1:u1");
  });
});
