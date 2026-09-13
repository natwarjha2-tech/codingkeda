import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/discount
 * Returns the logged-in user's usable (unconsumed) purchase discounts and the
 * single best one to apply at checkout (highest percent, newest on tie).
 *
 * Response:
 *   { success: true, discount: { id, percent, label, source } | null, discounts: [...] }
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const discounts = await prisma.userDiscount.findMany({
      where: { userId: user!.userId, consumed: false },
      orderBy: [{ percent: "desc" }, { createdAt: "desc" }],
      select: { id: true, percent: true, label: true, source: true, code: true, createdAt: true },
    });

    const best = discounts.length > 0 ? discounts[0] : null;

    return apiSuccess({ discount: best, discounts });
  } catch {
    return apiError(500, "Internal server error");
  }
}
