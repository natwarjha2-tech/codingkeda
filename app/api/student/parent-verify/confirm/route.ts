import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { ParentVerifyError, confirmParentCode } from "@/app/services/parent-verify.service";

/**
 * POST /api/student/parent-verify/confirm   Body: { code: "123456" }
 * Checks the code. On success the parent's number is verified and the weekly
 * report is switched on. 5 wrong guesses discard the code.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    return apiSuccess(await confirmParentCode(user!.userId, String(body?.code ?? "")));
  } catch (err) {
    if (err instanceof ParentVerifyError) return apiError(err.status, err.message);
    logger.error("parent-verify", "confirm_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not check the code. Please try again.");
  }
}
