import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { purgeExpiredGuests } from "@/app/services/guest.service";

export const runtime = "nodejs";
export const maxDuration = 600;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  const got = req.headers.get("x-cron-secret") || "";
  if (secret.length < 24 || got.length !== secret.length) return false; // refuse weak/missing secrets
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * POST /api/cron/purge-guests   (header: x-cron-secret)
 * Deletes guest accounts whose 4-hour login has expired (visitors who closed
 * the tab instead of pressing "leave"). Run once a day from the server crontab.
 * Only role "guest" accounts on the reserved guest email domain are touched.
 */
export async function POST(req: NextRequest) {
  if (!authorised(req)) return apiError(401, "Unauthorized.");
  try {
    const result = await purgeExpiredGuests();
    logger.info("guest", "purge_run", result);
    return apiSuccess({ result });
  } catch (err) {
    logger.error("guest", "purge_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "The guest purge failed.");
  }
}
