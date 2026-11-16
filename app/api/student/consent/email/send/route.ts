import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { ConsentError, sendParentEmailCode } from "@/app/services/parent-consent.service";

/**
 * POST /api/student/consent/email/send
 * Emails a 6-digit code to the parent email saved on the student's profile.
 * Limits: 1 per minute, 5 per day per student, 10 per day per email address.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    return apiSuccess(await sendParentEmailCode(user!.userId));
  } catch (err) {
    if (err instanceof ConsentError) return apiError(err.status, err.message);
    logger.error("parent-consent", "send_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not send the code. Please try again.");
  }
}
