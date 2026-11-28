import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { isGuestRole } from "@/app/lib/guest";
import { deleteGuest } from "@/app/services/guest.service";

export const runtime = "nodejs";

/**
 * POST /api/guest/end
 * The guest confirmed "leave the classroom": delete their temporary account
 * and everything they did. Only works with a guest's own login; a real
 * student's token is refused (and deleteGuest re-checks in the database).
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    if (!isGuestRole(user!.role)) return apiError(403, "Only guest sessions can be ended here.");
    const ok = await deleteGuest(user!.userId);
    if (!ok) return apiError(403, "Only guest sessions can be ended here.");
    return apiSuccess({ deleted: true });
  } catch (err) {
    logger.error("guest", "end_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not end the guest session.");
  }
}
