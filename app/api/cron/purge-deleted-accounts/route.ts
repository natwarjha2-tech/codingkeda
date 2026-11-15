import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { purgeDueAccounts } from "@/app/services/account-deletion.service";

export const runtime = "nodejs";
export const maxDuration = 600;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  const got = req.headers.get("x-cron-secret") || "";
  if (secret.length < 24 || got.length !== secret.length) return false; // refuse weak/missing secrets
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * POST /api/cron/purge-deleted-accounts   (header: x-cron-secret)
 * Erases the personal data of accounts whose 30-day deletion grace period is
 * over. Run once a day from the server crontab. Safe to run repeatedly.
 */
export async function POST(req: NextRequest) {
  if (!authorised(req)) return apiError(401, "Unauthorized.");
  try {
    const result = await purgeDueAccounts(50);
    logger.info("account-deletion", "purge_run", result);
    return apiSuccess({ result });
  } catch (err) {
    logger.error("account-deletion", "purge_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "The purge run failed.");
  }
}
