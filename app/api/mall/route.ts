import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/mall
 * Returns available offers, rewards, and user's coin balance.
 * Used by: Desktop app "CodingKida Mall", Mobile app
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    const userId = payload.userId;

    // Get user's coin balance
    const userCoins = await prisma.userCoins.findUnique({ where: { userId } });
    const balance = userCoins?.totalCoins || 0;

    // Available offers (static for now — can be made dynamic from DB later)
    const offers = [
      {
        id: "offer-1",
        title: "10% Off Any Course",
        description: "Get 10% discount on your next course purchase",
        coinsRequired: 200,
        type: "discount",
        discountPercent: 10,
        icon: "🎫",
        available: balance >= 200,
      },
      {
        id: "offer-2",
        title: "25% Off Any Course",
        description: "Get 25% discount on your next course purchase",
        coinsRequired: 500,
        type: "discount",
        discountPercent: 25,
        icon: "🏷️",
        available: balance >= 500,
      },
      {
        id: "offer-3",
        title: "Free Course Access (1 Month)",
        description: "Access any one course free for 1 month",
        coinsRequired: 1000,
        type: "free_access",
        icon: "🎁",
        available: balance >= 1000,
      },
      {
        id: "offer-4",
        title: "Certificate Frame",
        description: "Get a premium digital certificate frame",
        coinsRequired: 300,
        type: "reward",
        icon: "🖼️",
        available: balance >= 300,
      },
      {
        id: "offer-5",
        title: "1-on-1 Doubt Session",
        description: "30-minute live doubt clearing with instructor",
        coinsRequired: 750,
        type: "session",
        icon: "👨‍🏫",
        available: balance >= 750,
      },
    ];

    return NextResponse.json({
      success: true,
      balance,
      offers,
    });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
