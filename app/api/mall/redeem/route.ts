import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { notifyCoinsSpent, notifyCouponRedeemed } from "@/app/lib/notification";
import { applyReferralCode } from "@/app/lib/referral";

/**
 * POST /api/mall/redeem
 * Redeem coins for an offer or apply a coupon code.
 * Body: { offerId: string } OR { couponCode: string }
 *
 * When a DISCOUNT is redeemed (coin offer or coupon), we persist a
 * UserDiscount record so it can later be applied to ONE course purchase
 * on the payment page. Non-discount offers (free access / reward / session)
 * behave as before (coins deducted, no discount stored).
 */

// Coin offers that grant a purchase discount. Keep in sync with app/api/mall/route.ts.
const OFFER_CATALOG: Record<
  string,
  { cost: number; percent?: number; label: string }
> = {
  "offer-1": { cost: 200, percent: 10, label: "10% Off Any Course" },
  "offer-2": { cost: 500, percent: 25, label: "25% Off Any Course" },
  "offer-3": { cost: 1000, label: "Free Course Access (1 Month)" },
  "offer-4": { cost: 300, label: "Certificate Frame" },
  "offer-5": { cost: 750, label: "1-on-1 Doubt Session" },
};

const VALID_COUPONS: Record<string, { discount: number; description: string }> = {
  WELCOME10: { discount: 10, description: "Welcome 10% discount" },
  CODING20: { discount: 20, description: "CodingKida 20% discount" },
  FIRST50: { discount: 50, description: "First purchase 50% discount" },
};

export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const body = await req.json();

    // ── Coupon code redemption ──────────────────────────────────────────────
    if (body.couponCode) {
      const code = String(body.couponCode).trim().toUpperCase();
      const coupon = VALID_COUPONS[code];

      // If it's not a known discount coupon, try treating it as a REFERRAL code
      // (the CK Mall coupon box accepts both). Referral → the user gets coins.
      if (!coupon) {
        const ref = await applyReferralCode(user!.userId, code);
        if (ref.ok) {
          return apiSuccess({ message: ref.message, referral: { coinsAwarded: ref.coinsAwarded } });
        }
        // Not a coupon and not a valid referral — surface the referral reason
        // (e.g. "already used", "your own code") which is more helpful than a
        // generic "invalid coupon".
        return apiError(ref.status, ref.message === "Invalid code." ? "Invalid coupon or referral code." : ref.message);
      }

      // Prevent redeeming the SAME coupon twice while one is still unused.
      const existing = await prisma.userDiscount.findFirst({
        where: { userId: user!.userId, code, consumed: false },
      });
      if (existing) {
        return apiSuccess({
          message: "Coupon already applied. It's ready to use at checkout.",
          coupon: { code, discount: coupon.discount, description: coupon.description },
          discount: { id: existing.id, percent: existing.percent },
        });
      }

      const discount = await prisma.userDiscount.create({
        data: {
          userId: user!.userId,
          percent: coupon.discount,
          source: "coupon",
          code,
          label: coupon.description,
          coinsSpent: 0,
        },
      });

      // Coupon redeemed notification (non-blocking)
      try {
        await notifyCouponRedeemed({
          userId: user!.userId,
          label: `Coupon ${code}`,
          detail: coupon.description,
          idempotencyKey: `${user!.userId}:${code}`,
        });
      } catch {
        /* notification failure must not block coupon */
      }

      return apiSuccess({
        message: "Coupon applied successfully!",
        coupon: { code, discount: coupon.discount, description: coupon.description },
        discount: { id: discount.id, percent: discount.percent },
      });
    }

    // ── Coin redemption for an offer ─────────────────────────────────────────
    if (body.offerId) {
      const offer = OFFER_CATALOG[String(body.offerId)];
      if (!offer) return apiError(400, "Invalid offer");
      const cost = offer.cost;

      const userCoins = await prisma.userCoins.findUnique({ where: { userId: user!.userId } });
      if (!userCoins || userCoins.totalCoins < cost) return apiError(400, "Insufficient coins");

      // Deduct coins + record the spend + (for discount offers) store the discount
      // atomically so we never deduct coins without granting the reward.
      const result = await prisma.$transaction(async (tx) => {
        await tx.userCoins.update({
          where: { userId: user!.userId },
          data: { totalCoins: { decrement: cost } },
        });

        await tx.coinTransaction.create({
          data: {
            userId: user!.userId,
            coins: cost,
            type: "SPENT",
            reason: `Redeemed: ${offer.label}`,
          },
        });

        let discount = null;
        if (offer.percent) {
          discount = await tx.userDiscount.create({
            data: {
              userId: user!.userId,
              percent: offer.percent,
              source: "offer",
              offerId: String(body.offerId),
              label: offer.label,
              coinsSpent: cost,
            },
          });
        }
        return { discount };
      });

      // Coins spent notification (non-blocking)
      try {
        await notifyCoinsSpent({
          userId: user!.userId,
          coins: cost,
          reason: `CK Mall: ${offer.label}`,
          idempotencyKey: `${user!.userId}:${body.offerId}:${Date.now()}`,
        });
      } catch {
        /* notification failure must not block offer redeem */
      }

      return apiSuccess({
        message: offer.percent
          ? `${offer.percent}% discount unlocked! Apply it at checkout.`
          : "Offer redeemed successfully!",
        newBalance: userCoins.totalCoins - cost,
        discount: result.discount
          ? { id: result.discount.id, percent: result.discount.percent }
          : null,
      });
    }

    return apiError(400, "Provide offerId or couponCode");
  } catch {
    return apiError(500, "Internal server error");
  }
}
