import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { ensureReferralCode, REFERRAL_REWARD_NEW_USER, REFERRAL_REWARD_REFERRER } from "@/app/lib/referral";

/**
 * GET /api/referral
 * Returns the logged-in user's referral code + real stats:
 *   { success, code, referredCount, coinsEarned, hasApplied, canApply }
 * - referredCount: how many friends used this user's code
 * - coinsEarned: coins this user earned as a referrer (paid on friends' first purchase)
 * - hasApplied: whether this user already entered someone's code
 * - canApply: whether this user is still eligible to enter a code
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const userId = user!.userId;

    const code = await ensureReferralCode(userId);

    const [referralsMade, myReferral, purchaseCount] = await Promise.all([
      prisma.referral.findMany({ where: { referrerId: userId }, select: { referrerReward: true } }),
      prisma.referral.findUnique({ where: { referreduserId: userId }, select: { id: true } }),
      prisma.payment.count({ where: { userId, status: "success" } }),
    ]);

    const referredCount = referralsMade.length;
    const coinsEarned = referralsMade.reduce((sum, r) => sum + (r.referrerReward || 0), 0);
    const hasApplied = !!myReferral;
    // Eligible to enter a code only if they haven't already, and haven't purchased yet.
    const canApply = !hasApplied && purchaseCount === 0;

    return apiSuccess({
      code,
      referredCount,
      coinsEarned,
      hasApplied,
      canApply,
      rewardNewUser: REFERRAL_REWARD_NEW_USER,
      rewardReferrer: REFERRAL_REWARD_REFERRER,
    });
  } catch {
    return apiError(500, "Internal server error");
  }
}
