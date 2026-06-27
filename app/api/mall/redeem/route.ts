import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * POST /api/mall/redeem
 * Redeem coins for an offer or apply a coupon code.
 * Body: { offerId: string } OR { couponCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    const userId = payload.userId;
    const body = await req.json();

    // Coupon code redemption
    if (body.couponCode) {
      const code = body.couponCode.trim().toUpperCase();
      
      // Static coupon codes (can be made dynamic from DB later)
      const validCoupons: Record<string, { discount: number; description: string }> = {
        "WELCOME10": { discount: 10, description: "Welcome 10% discount" },
        "CODING20": { discount: 20, description: "CodingKida 20% discount" },
        "FIRST50": { discount: 50, description: "First purchase 50% discount" },
      };

      if (!validCoupons[code]) {
        return NextResponse.json({ success: false, message: "Invalid coupon code" }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Coupon applied successfully!",
        coupon: { code, ...validCoupons[code] },
      });
    }

    // Coin redemption for offer
    if (body.offerId) {
      const offerCosts: Record<string, number> = {
        "offer-1": 200,
        "offer-2": 500,
        "offer-3": 1000,
        "offer-4": 300,
        "offer-5": 750,
      };

      const cost = offerCosts[body.offerId];
      if (!cost) return NextResponse.json({ success: false, message: "Invalid offer" }, { status: 400 });

      // Check balance
      const userCoins = await prisma.userCoins.findUnique({ where: { userId } });
      if (!userCoins || userCoins.totalCoins < cost) {
        return NextResponse.json({ success: false, message: "Insufficient coins" }, { status: 400 });
      }

      // Deduct coins
      await prisma.userCoins.update({
        where: { userId },
        data: { totalCoins: { decrement: cost } },
      });

      // Record transaction
      await prisma.coinTransaction.create({
        data: {
          userId,
          coins: cost,
          type: "SPENT",
          reason: `Redeemed offer: ${body.offerId}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Offer redeemed successfully!",
        newBalance: userCoins.totalCoins - cost,
      });
    }

    return NextResponse.json({ success: false, message: "Provide offerId or couponCode" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
