import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { ConsentError, confirmParentEmailCode } from "@/app/services/parent-consent.service";

/**
 * POST /api/student/consent/email/confirm   body: { code }
 * Checks the code the parent gave. 5 wrong tries throw the code away.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    return apiSuccess(await confirmParentEmailCode(user!.userId, String(body?.code ?? "")));
  } catch (err) {
    if (err instanceof ConsentError) return apiError(err.status, err.message);
    logger.error("parent-consent", "confirm_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not check the code. Please try again.");
  }
}
