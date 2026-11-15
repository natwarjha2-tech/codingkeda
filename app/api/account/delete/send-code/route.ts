import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { AccountDeletionError, sendDeletionCode } from "@/app/services/account-deletion.service";

/**
 * POST /api/account/delete/send-code
 * Emails a 6-digit code to the account email to confirm account deletion.
 * One code per minute; a code is valid for 10 minutes.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    return apiSuccess(await sendDeletionCode(user!.userId));
  } catch (err) {
    if (err instanceof AccountDeletionError) return apiError(err.status, err.message);
    logger.error("account-deletion", "send_code_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not send the code. Please try again.");
  }
}
