import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { ParentVerifyError, sendParentCode } from "@/app/services/parent-verify.service";

/**
 * POST /api/student/parent-verify/send
 * Sends a 6-digit code on WhatsApp to the parent number saved on the student's
 * profile. Limits: 1 per minute, 5 per day per student, 10 per day per number.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    return apiSuccess(await sendParentCode(user!.userId));
  } catch (err) {
    if (err instanceof ParentVerifyError) return apiError(err.status, err.message);
    logger.error("parent-verify", "send_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not send the code. Please try again.");
  }
}
