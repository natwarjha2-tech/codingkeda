import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from "@/app/lib/notification";

/**
 * POST /api/notifications
 * 
 * Single endpoint for all notification client operations.
 * Action-based routing via request body { action: "..." }
 * 
 * Actions:
 *   "sync"           — Fetch notifications (cursor-based). Body: { after?, limit? }
 *   "unread-count"   — Get unread count only (lightweight)
 *   "mark-read"      — Mark one as read. Body: { id }
 *   "mark-all-read"  — Mark all as read
 *   "delete"         — Delete one. Body: { id }
 *   "clear-all"      — Clear all notifications
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const body = await req.json();
    const action = body.action;

    if (!action) return apiError(400, "action is required.");

    const userId = user!.userId;

    switch (action) {
      case "sync": {
        const result = await getNotifications(userId, {
          after: body.after || undefined,
          limit: body.limit || 30,
        });
        return apiSuccess(result);
      }

      case "unread-count": {
        const unreadCount = await getUnreadCount(userId);
        return apiSuccess({ unreadCount });
      }

      case "mark-read": {
        if (!body.id) return apiError(400, "id is required.");
        const marked = await markAsRead(userId, body.id);
        return apiSuccess({ success: marked });
      }

      case "mark-all-read": {
        const count = await markAllAsRead(userId);
        return apiSuccess({ success: true, count });
      }

      case "delete": {
        if (!body.id) return apiError(400, "id is required.");
        const deleted = await deleteNotification(userId, body.id);
        return apiSuccess({ success: deleted });
      }

      case "clear-all": {
        const count = await clearAllNotifications(userId);
        return apiSuccess({ success: true, count });
      }

      default:
        return apiError(400, `Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("Notification API error:", err);
    return apiError(500, "Internal server error.");
  }
}
