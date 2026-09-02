import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { apiSuccess, apiError } from "@/app/lib/response";
import { sendExpoPush, isDesktopDevice, isValidExpoPushToken } from "@/app/lib/push-adapters";

/**
 * POST /api/cron/process-notifications
 * 
 * Outbox processor — picks up pending notification delivery entries,
 * sends push notifications to registered devices, handles retries.
 * 
 * Triggered by:
 *   - External cron service (cron-job.org free tier) — every 1 minute
 *     (Vercel Hobby plan only allows daily cron, so external cron is used)
 *   - EC2: internal setInterval or node-cron
 * 
 * Security: Validated via CRON_SECRET header (x-cron-secret or Authorization: Bearer).
 * 
 * Batch size: 50 per invocation (stays within Vercel 10s function limit).
 */

const CRON_SECRET = process.env.CRON_SECRET || "";
const MAX_BATCH = 50;
const MAX_RETRIES = 5;

// Exponential backoff: 1min, 5min, 15min, 1hr, 4hr
const RETRY_DELAYS_MS = [60000, 300000, 900000, 3600000, 14400000];

/**
 * Verify the request is authorized (cron secret check).
 * Supports both custom header (external cron/EC2) and Vercel Cron (Authorization: Bearer).
 */
function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return true; // No secret configured = allow (dev)
  const authHeader = req.headers.get("x-cron-secret") || req.headers.get("authorization");
  return authHeader === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;
}

/**
 * GET handler — used by Vercel Cron (sends GET with Authorization: Bearer CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return apiError(401, "Unauthorized.");
  return processOutbox();
}

/**
 * POST handler — used by external cron services (cron-job.org) and EC2.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return apiError(401, "Unauthorized.");
  return processOutbox();
}

/**
 * Core outbox processing logic (shared by GET and POST).
 */
async function processOutbox() {
  try {
    const now = new Date();

    // Fetch pending outbox entries ready for processing
    const pendingEntries = await prisma.notificationOutbox.findMany({
      where: {
        status: "pending",
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      take: MAX_BATCH,
      orderBy: { createdAt: "asc" },
    });

    if (pendingEntries.length === 0) {
      return apiSuccess({ processed: 0, message: "No pending notifications." });
    }

    let delivered = 0;
    let failed = 0;
    let dead = 0;

    for (const entry of pendingEntries) {
      // Mark as processing
      await prisma.notificationOutbox.update({
        where: { id: entry.id },
        data: { status: "processing", lastAttemptAt: now },
      });

      // Get user's active devices
      const devices = await prisma.userDevice.findMany({
        where: { userId: entry.userId, active: true },
      });

      if (devices.length === 0) {
        // No devices registered — mark as delivered (notification saved in DB, user will see on sync)
        await prisma.notificationOutbox.update({
          where: { id: entry.id },
          data: { status: "delivered", lastAttemptAt: now },
        });
        delivered++;
        continue;
      }

      // Get notification data for push payload
      const notification = await prisma.notification.findUnique({
        where: { id: entry.notificationId },
        select: { id: true, type: true, title: true, body: true, priority: true },
      });

      if (!notification) {
        // Notification was deleted — clean up outbox
        await prisma.notificationOutbox.update({
          where: { id: entry.id },
          data: { status: "dead", error: "Notification not found" },
        });
        dead++;
        continue;
      }

      // Separate mobile and desktop devices
      const mobileDevices = devices.filter(
        (d) => !isDesktopDevice(d.platform) && d.pushToken && isValidExpoPushToken(d.pushToken)
      );
      const desktopDevices = devices.filter((d) => isDesktopDevice(d.platform));

      let allSuccess = true;
      let errorMsg = "";

      // Send push to mobile devices via Expo
      if (mobileDevices.length > 0) {
        const pushMessages = mobileDevices.map((d) => ({
          to: d.pushToken!,
          title: notification.title,
          body: notification.body,
          data: { notificationId: notification.id, type: notification.type },
          priority: notification.priority === "HIGH" || notification.priority === "CRITICAL" ? "high" as const : "default" as const,
        }));

        const results = await sendExpoPush(pushMessages);

        // Handle invalid tokens
        for (let i = 0; i < results.length; i++) {
          if (results[i].invalidToken) {
            // Deactivate device with invalid token
            await prisma.userDevice.update({
              where: { id: mobileDevices[i].id },
              data: { active: false },
            });
          }
          if (!results[i].success) {
            allSuccess = false;
            errorMsg = results[i].error || "Push delivery failed";
          }
        }
      }

      // Desktop: no push needed — mark as delivered (user syncs on app open)
      // Desktop devices existence doesn't affect delivery status

      if (allSuccess || mobileDevices.length === 0) {
        // Success: all pushes sent (or no mobile devices = desktop-only user)
        await prisma.notificationOutbox.update({
          where: { id: entry.id },
          data: { status: "delivered", lastAttemptAt: now, attempts: entry.attempts + 1 },
        });
        delivered++;
      } else {
        // Some failed — retry or dead-letter
        const newAttempts = entry.attempts + 1;
        if (newAttempts >= MAX_RETRIES) {
          await prisma.notificationOutbox.update({
            where: { id: entry.id },
            data: { status: "dead", lastAttemptAt: now, attempts: newAttempts, error: errorMsg },
          });
          dead++;
        } else {
          const delay = RETRY_DELAYS_MS[Math.min(newAttempts - 1, RETRY_DELAYS_MS.length - 1)];
          await prisma.notificationOutbox.update({
            where: { id: entry.id },
            data: {
              status: "pending",
              lastAttemptAt: now,
              attempts: newAttempts,
              nextRetryAt: new Date(now.getTime() + delay),
              error: errorMsg,
            },
          });
          failed++;
        }
      }
    }

    return apiSuccess({
      processed: pendingEntries.length,
      delivered,
      failed,
      dead,
    });
  } catch (err) {
    console.error("Cron process-notifications error:", err);
    return apiError(500, "Internal server error.");
  }
}
