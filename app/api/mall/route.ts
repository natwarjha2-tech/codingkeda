import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/mall
 * Returns available offers, rewards, and user's coin balance.
 * Used by: Desktop app "CodingKida Mall", Mobile app
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const userCoins = await prisma.userCoins.findUnique({ where: { userId: user!.userId } });
    const balance = userCoins?.totalCoins || 0;

    // Available offers (static — can be made dynamic from DB later)
    const offers = [
      { id: "offer-1", title: "10% Off Any Course", description: "Get 10% discount on your next course purchase", coinsRequired: 200, type: "discount", discountPercent: 10, icon: "🎫", available: balance >= 200 },
      { id: "offer-2", title: "25% Off Any Course", description: "Get 25% discount on your next course purchase", coinsRequired: 500, type: "discount", discountPercent: 25, icon: "🏷️", available: balance >= 500 },
      { id: "offer-3", title: "Free Course Access (1 Month)", description: "Access any one course free for 1 month", coinsRequired: 1000, type: "free_access", icon: "🎁", available: balance >= 1000 },
      { id: "offer-4", title: "Certificate Frame", description: "Get a premium digital certificate frame", coinsRequired: 300, type: "reward", icon: "🖼️", available: balance >= 300 },
      { id: "offer-5", title: "1-on-1 Doubt Session", description: "30-minute live doubt clearing with instructor", coinsRequired: 750, type: "session", icon: "👨‍🏫", available: balance >= 750 },
    ];

    return apiSuccess({ balance, offers });
  } catch {
    return apiError(500, "Internal server error");
  }
}
