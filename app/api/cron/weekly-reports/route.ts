import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { runAutomaticWeeklyReports } from "@/app/services/weekly-report.service";

export const runtime = "nodejs";
export const maxDuration = 3600;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  const got = req.headers.get("x-cron-secret") || "";
  if (secret.length < 24 || got.length !== secret.length) return false; // refuse weak/missing secrets
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * POST /api/cron/weekly-reports
 * Called by a cron job on the server (not by users). Header: x-cron-secret.
 * Sends the weekly reports if automatic sending is switched ON in the admin
 * page, WhatsApp is live (WHATSAPP_DRY_RUN=false), and the parent is verified.
 */
export async function POST(req: NextRequest) {
  if (!authorised(req)) return apiError(401, "Unauthorized.");
  try {
    const result = await runAutomaticWeeklyReports();
    return apiSuccess({ result });
  } catch (err) {
    logger.error("weekly-report", "cron_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "The weekly run failed.");
  }
}
