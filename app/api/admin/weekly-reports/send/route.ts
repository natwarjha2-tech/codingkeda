import { NextRequest } from "next/server";
import { requireSuperAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { sendWeeklyReportBatch } from "@/app/services/weekly-report.service";

/**
 * POST /api/admin/weekly-reports/send  (super-admin)
 * Body: { limit?: number (1–100, default 50), retryFailed?: boolean }
 *
 * Sends ONE batch and returns how many remain; the admin page calls it again
 * until `remaining` is 0 or the daily limit is reached. In dry-run mode
 * (WHATSAPP_DRY_RUN != "false") nothing is sent and nothing is written.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireSuperAdmin(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(100, Math.floor(Number(body?.limit) || 50)));
    const result = await sendWeeklyReportBatch(limit, { retryFailed: !!body?.retryFailed });
    logger.info("weekly-report", "send_batch", {
      by: user!.userId, dryRun: result.dryRun, sent: result.sent, failed: result.failed, remaining: result.remaining,
    });
    return apiSuccess(result);
  } catch (err) {
    logger.error("weekly-report", "send_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not send the weekly reports.");
  }
}
