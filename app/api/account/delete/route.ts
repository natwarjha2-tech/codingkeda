import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { AccountDeletionError, getDeletionStatus, requestDeletion } from "@/app/services/account-deletion.service";

/**
 * GET  /api/account/delete  → { pending, scheduledFor, graceDays }
 * POST /api/account/delete  body: { code, reason?, channel? }
 *   Confirms the code emailed by /api/account/delete/send-code and schedules the
 *   deletion (30-day grace period; signing in again cancels it).
 */
export async function GET(req: NextRequest) {
  const { error, user } = requireAuth(req);
  if (error) return error;
  return apiSuccess(await getDeletionStatus(user!.userId));
}

export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const body = (await req.json().catch(() => ({}))) as { code?: unknown; reason?: unknown; channel?: unknown };
    const result = await requestDeletion(user!.userId, {
      code: String(body.code ?? ""),
      reason: typeof body.reason === "string" ? body.reason : "",
      channel: typeof body.channel === "string" ? body.channel : "",
    });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof AccountDeletionError) return apiError(err.status, err.message);
    logger.error("account-deletion", "request_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not delete the account. Please try again.");
  }
}
