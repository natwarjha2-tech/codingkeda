import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { notifyCoinsSpent, notifyCouponRedeemed } from "@/app/lib/notification";

/**
 * POST /api/mall/redeem
 * Redeem coins for an offer or apply a coupon code.
 * Body: { offerId: string } OR { couponCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const body = await req.json();

    // Coupon code redemption
    if (body.couponCode) {
      const code = body.couponCode.trim().toUpperCase();
      const validCoupons: Record<string, { discount: number; description: string }> = {
        "WELCOME10": { discount: 10, description: "Welcome 10% discount" },
        "CODING20": { discount: 20, description: "CodingKida 20% discount" },
        "FIRST50": { discount: 50, description: "First purchase 50% discount" },
      };

      if (!validCoupons[code]) return apiError(400, "Invalid coupon code");

      // Coupon redeemed notification (non-blocking)
      try {
        await notifyCouponRedeemed({
          userId: user!.userId,
          label: `Coupon ${code}`,
          detail: validCoupons[code].description,
          idempotencyKey: `${user!.userId}:${code}`,
        });
      } catch { /* notification failure must not block coupon */ }

      return apiSuccess({ message: "Coupon applied successfully!", coupon: { code, ...validCoupons[code] } });
    }

    // Coin redemption for offer
    if (body.offerId) {
      const offerCosts: Record<string, number> = { "offer-1": 200, "offer-2": 500, "offer-3": 1000, "offer-4": 300, "offer-5": 750 };
      const cost = offerCosts[body.offerId];
      if (!cost) return apiError(400, "Invalid offer");

      const userCoins = await prisma.userCoins.findUnique({ where: { userId: user!.userId } });
      if (!userCoins || userCoins.totalCoins < cost) return apiError(400, "Insufficient coins");

      await prisma.userCoins.update({
        where: { userId: user!.userId },
        data: { totalCoins: { decrement: cost } },
      });

      await prisma.coinTransaction.create({
        data: { userId: user!.userId, coins: cost, type: "SPENT", reason: `Redeemed offer: ${body.offerId}` },
      });

      // Coins spent (offer redeem) notification (non-blocking)
      try {
        await notifyCoinsSpent({
          userId: user!.userId,
          coins: cost,
          reason: `CK Mall offer redeemed`,
          idempotencyKey: `${user!.userId}:${body.offerId}:${Date.now()}`,
        });
      } catch { /* notification failure must not block offer redeem */ }

      return apiSuccess({ message: "Offer redeemed successfully!", newBalance: userCoins.totalCoins - cost });
    }

    return apiError(400, "Provide offerId or couponCode");
  } catch {
    return apiError(500, "Internal server error");
  }
}
