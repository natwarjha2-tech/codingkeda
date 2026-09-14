import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { applyReferralCode } from "@/app/lib/referral";

/**
 * POST /api/referral/apply
 * Body: { code: string }
 * Apply a friend's referral code (the new user immediately gets bonus coins).
 * Kept for compatibility; the CK Mall coupon box also applies referral codes.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const result = await applyReferralCode(user!.userId, body.code);

    if (!result.ok) return apiError(result.status, result.message);
    return apiSuccess({ message: result.message, coinsAwarded: result.coinsAwarded });
  } catch {
    return apiError(500, "Internal server error");
  }
}
