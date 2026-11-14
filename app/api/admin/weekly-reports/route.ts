import { NextRequest } from "next/server";
import { requireSuperAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { previewWeeklyReports } from "@/app/services/weekly-report.service";

/**
 * GET /api/admin/weekly-reports  (super-admin)
 * Preview for the "Weekly parent reports" admin page: the week, WhatsApp
 * settings (no secrets), how many parents would receive a message and why
 * others are skipped, and three sample messages. Read-only — sends nothing.
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireSuperAdmin(req);
    if (error) return error;
    return apiSuccess(await previewWeeklyReports());
  } catch (err) {
    logger.error("weekly-report", "preview_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not build the weekly report preview.");
  }
}
