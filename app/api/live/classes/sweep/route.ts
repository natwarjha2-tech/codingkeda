import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/app/lib/response";
import { isLiveClassConfigured, LIVE_CRON_SECRET } from "@/app/lib/live/live-config";
import { autoEndStaleClasses } from "@/app/lib/live/live-service";

/**
 * POST /api/live/classes/sweep
 * Header: x-cron-secret: <LIVE_CRON_SECRET>
 *
 * Optional, secret-protected trigger for the host-disconnect stale-sweep
 * (Phase 3). The lazy on-read sweep (in list/join) already covers the common
 * case; this endpoint lets an external scheduler (system cron / CI) force a
 * sweep even when no one is reading the list. Disabled unless LIVE_CRON_SECRET
 * is set. `force` bypasses the throttle so a scheduled call always sweeps.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isLiveClassConfigured()) {
      return apiError(503, "Live class feature is currently unavailable.");
    }
    // Endpoint stays off until a secret is configured (safe default).
    if (!LIVE_CRON_SECRET) {
      return apiError(404, "Not found.");
    }

    const provided = req.headers.get("x-cron-secret") || "";
    if (provided !== LIVE_CRON_SECRET) {
      return apiError(401, "Unauthorized.");
    }

    const ended = await autoEndStaleClasses({ force: true });
    return apiSuccess({ ended });
  } catch (err) {
    console.error("Live sweep error:", err);
    return apiError(500, "Internal server error.");
  }
}
