/**
 * CodingKida — Notification Service
 * 
 * Centralized notification creation, retrieval, and management.
 * All notification logic goes through this service.
 * 
 * Features:
 * - Idempotent creation (DB unique constraint on [userId, idempotencyKey])
 * - Outbox pattern for reliable delivery
 * - Cursor-based sync for clients
 * - User-scoped access (all queries filtered by userId)
 */

import { prisma } from "@/app/lib/prisma";
import {
  CreateNotificationInput,
  NOTIF_PRIORITIES,
} from "@/app/lib/notification-types";

// ═══════════════════════════════════════════════════════
// CREATE NOTIFICATION (Idempotent + Outbox)
// ═══════════════════════════════════════════════════════

/**
 * Create a notification for a user (idempotent).
 * Also creates an outbox entry for push delivery.
 * Returns the notification or null if duplicate.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ id: string } | null> {
  try {
    // Idempotency: unique constraint on [userId, idempotencyKey] prevents duplicates
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        category: input.category,
        priority: input.priority || NOTIF_PRIORITIES.NORMAL,
        title: input.title,
        body: input.body,
        metadata: input.metadata || undefined,
        action: input.action || undefined,
        idempotencyKey: input.idempotencyKey,
        expiresAt: input.expiresAt || null,
      },
    });

    // Create outbox entry for push delivery (non-blocking if fails)
    try {
      await prisma.notificationOutbox.create({
        data: {
          notificationId: notification.id,
          userId: input.userId,
          status: "pending",
        },
      });
    } catch {
      // Outbox creation failure should not fail notification creation
    }

    return { id: notification.id };
  } catch (err: unknown) {
    // Unique constraint violation = duplicate, return null silently
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return null;
    }
    // P2002 = Prisma unique constraint error code
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return null;
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// RETRIEVE NOTIFICATIONS (Cursor-based sync)
// ═══════════════════════════════════════════════════════

/**
 * Get notifications for a user (cursor-based sync).
 * Returns items newer than `after` timestamp, ordered newest first.
 */
export async function getNotifications(
  userId: string,
  options: { after?: string; limit?: number } = {}
): Promise<{
  items: Array<{
    id: string;
    type: string;
    category: string;
    priority: string;
    title: string;
    body: string;
    metadata: unknown;
    action: unknown;
    read: boolean;
    createdAt: Date;
  }>;
  nextCursor: string | null;
  unreadCount: number;
}> {
  const limit = Math.min(options.limit || 30, 50);

  const where: { userId: string; createdAt?: { gt: Date } } = { userId };
  if (options.after) {
    where.createdAt = { gt: new Date(options.after) };
  }

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        category: true,
        priority: true,
        title: true,
        body: true,
        metadata: true,
        action: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
  ]);

  const nextCursor =
    items.length === limit ? items[items.length - 1].createdAt.toISOString() : null;

  return { items, nextCursor, unreadCount };
}

/**
 * Get unread count only (lightweight).
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

// ═══════════════════════════════════════════════════════
// MARK AS READ
// ═══════════════════════════════════════════════════════

/**
 * Mark a single notification as read.
 */
export async function markAsRead(userId: string, notifId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notifId, userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return result.count;
}

// ═══════════════════════════════════════════════════════
// DELETE / CLEAR
// ═══════════════════════════════════════════════════════

/**
 * Delete a single notification.
 */
export async function deleteNotification(userId: string, notifId: string): Promise<boolean> {
  const result = await prisma.notification.deleteMany({
    where: { id: notifId, userId },
  });
  return result.count > 0;
}

/**
 * Clear all notifications for a user.
 */
export async function clearAllNotifications(userId: string): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: { userId },
  });
  return result.count;
}

// ═══════════════════════════════════════════════════════
// EVENT-SPECIFIC HELPERS (Idempotent creators)
// ═══════════════════════════════════════════════════════

/**
 * Notify: Course enrolled successfully after payment.
 */
export async function notifyCourseEnrolled(opts: {
  userId: string;
  courseId: string;
  courseName: string;
  paymentId?: string;
}) {
  return createNotification({
    userId: opts.userId,
    type: "course_enrolled",
    category: "payment",
    priority: "HIGH",
    title: "Course Enrolled Successfully 🎉",
    body: `You have successfully enrolled in: ${opts.courseName}`,
    metadata: { courseId: opts.courseId, courseName: opts.courseName, paymentId: opts.paymentId },
    action: { type: "deeplink", target: `/courses/${opts.courseId}` },
    idempotencyKey: `course_enrolled:${opts.userId}:${opts.courseId}`,
  });
}

/**
 * Notify: Payment failed.
 */
export async function notifyPaymentFailed(opts: {
  userId: string;
  courseId: string;
  courseName: string;
  orderId: string;
}) {
  return createNotification({
    userId: opts.userId,
    type: "payment_failed",
    category: "payment",
    priority: "HIGH",
    title: "Payment Failed",
    body: `Your payment for "${opts.courseName}" could not be completed. Please try again.`,
    metadata: { courseId: opts.courseId, courseName: opts.courseName, orderId: opts.orderId },
    action: { type: "deeplink", target: "/courses" },
    idempotencyKey: `payment_failed:${opts.orderId}`,
  });
}

/**
 * Notify: New course published (for a specific user).
 * For bulk: call this per-user or use broadcast pattern.
 */
export async function notifyNewCourse(opts: {
  userId: string;
  courseId: string;
  courseName: string;
}) {
  return createNotification({
    userId: opts.userId,
    type: "new_course",
    category: "announcement",
    priority: "NORMAL",
    title: "New Course Available 🚀",
    body: `${opts.courseName} is now available on CodingKida. Start learning today.`,
    metadata: { courseId: opts.courseId, courseName: opts.courseName },
    action: { type: "deeplink", target: `/courses/${opts.courseId}` },
    idempotencyKey: `new_course:${opts.courseId}:${opts.userId}`,
  });
}

/**
 * Notify: Achievement earned (quiz rank, badge).
 */
export async function notifyAchievement(opts: {
  userId: string;
  title: string;
  badgeType: string;
  lessonId: string;
  courseId?: string;
}) {
  return createNotification({
    userId: opts.userId,
    type: "achievement",
    category: "achievement",
    priority: "NORMAL",
    title: "Achievement Unlocked 🏆",
    body: `Congratulations! You earned the "${opts.title}" achievement.`,
    metadata: { badgeType: opts.badgeType, lessonId: opts.lessonId, courseId: opts.courseId },
    action: { type: "deeplink", target: "/achievements" },
    idempotencyKey: `achievement:${opts.userId}:${opts.lessonId}:${opts.badgeType}`,
  });
}

/**
 * Notify: Weekly streak passed.
 */
export async function notifyWeeklyStreak(opts: {
  userId: string;
  streakId: string;
  courseName: string;
  weekNumber: number;
}) {
  return createNotification({
    userId: opts.userId,
    type: "weekly_streak",
    category: "achievement",
    priority: "NORMAL",
    title: "Weekly Streak Achieved 🔥",
    body: `Congratulations! You earned a ${opts.weekNumber}-week streak in: ${opts.courseName}`,
    metadata: { streakId: opts.streakId, courseName: opts.courseName, weekNumber: opts.weekNumber },
    action: { type: "deeplink", target: "/achievements" },
    idempotencyKey: `streak_pass:${opts.userId}:${opts.streakId}`,
  });
}

/**
 * Notify: Leaderboard winner (coding problems).
 */
export async function notifyLeaderboardWinner(opts: {
  userId: string;
  problemId: string;
  problemTitle: string;
  rank: number;
  coinsAwarded: number;
}) {
  return createNotification({
    userId: opts.userId,
    type: "leaderboard_winner",
    category: "achievement",
    priority: "NORMAL",
    title: `🏆 Leaderboard Rank #${opts.rank}!`,
    body: `You secured rank #${opts.rank} in "${opts.problemTitle}" and earned ${opts.coinsAwarded} coins!`,
    metadata: { problemId: opts.problemId, problemTitle: opts.problemTitle, rank: opts.rank, coinsAwarded: opts.coinsAwarded },
    action: { type: "deeplink", target: "/coding" },
    idempotencyKey: `leaderboard:${opts.problemId}:${opts.userId}`,
  });
}

/**
 * Notify: Custom admin notification (for a specific user).
 */
export async function notifyCustom(opts: {
  userId: string;
  title: string;
  body: string;
  action?: { type: "deeplink" | "external"; target: string };
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}) {
  return createNotification({
    userId: opts.userId,
    type: "custom",
    category: "announcement",
    priority: "NORMAL",
    title: opts.title,
    body: opts.body,
    metadata: opts.metadata,
    action: opts.action,
    idempotencyKey: opts.idempotencyKey,
  });
}
