/**
 * CodingKida — Notification Type Registry
 * 
 * Centralized constants for notification types, categories, and priorities.
 * Adding a new notification type = add constant here + create helper in notification.ts.
 * Core system never needs modification for new types.
 */

// ═══════════════════════════════════════════════════════
// NOTIFICATION TYPES (extensible — add new types here)
// ═══════════════════════════════════════════════════════

export const NOTIF_TYPES = {
  COURSE_ENROLLED: "course_enrolled",
  PAYMENT_FAILED: "payment_failed",
  NEW_COURSE: "new_course",
  ACHIEVEMENT: "achievement",
  WEEKLY_STREAK: "weekly_streak",
  LEADERBOARD_WINNER: "leaderboard_winner",
  APP_UPDATE: "app_update",
  CUSTOM: "custom",
  // ── Added events ──
  COINS_EARNED: "coins_earned",         // #10
  COINS_SPENT: "coins_spent",           // #11
  BADGE_LOST: "badge_lost",             // #13 (rank dropped, achievement changed)
  PASSWORD_CHANGED: "password_changed", // #14
  NEW_HOMEWORK: "new_homework",         // #15
  COUPON_REDEEMED: "coupon_redeemed",   // #18
  WELCOME: "welcome",                   // #19
  DOWNLOAD_EXPIRING: "download_expiring", // #17 (mobile client-side local)
} as const;

export type NotifType = (typeof NOTIF_TYPES)[keyof typeof NOTIF_TYPES];

// ═══════════════════════════════════════════════════════
// NOTIFICATION CATEGORIES
// ═══════════════════════════════════════════════════════

export const NOTIF_CATEGORIES = {
  PAYMENT: "payment",
  COURSE: "course",
  ACHIEVEMENT: "achievement",
  SYSTEM: "system",
  ANNOUNCEMENT: "announcement",
} as const;

export type NotifCategory = (typeof NOTIF_CATEGORIES)[keyof typeof NOTIF_CATEGORIES];

// ═══════════════════════════════════════════════════════
// NOTIFICATION PRIORITIES
// ═══════════════════════════════════════════════════════

export const NOTIF_PRIORITIES = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type NotifPriority = (typeof NOTIF_PRIORITIES)[keyof typeof NOTIF_PRIORITIES];

// ═══════════════════════════════════════════════════════
// NOTIFICATION ACTION TYPES (deep-link targets)
// ═══════════════════════════════════════════════════════

export interface NotifAction {
  type: "deeplink" | "external" | "update";
  target: string; // "/courses/xxx", "/achievements", "https://...", "restart"
}

// ═══════════════════════════════════════════════════════
// CREATE NOTIFICATION INPUT
// ═══════════════════════════════════════════════════════

export interface CreateNotificationInput {
  userId: string;
  type: NotifType;
  category: NotifCategory;
  priority?: NotifPriority;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  action?: NotifAction;
  idempotencyKey: string;
  expiresAt?: Date;
}
