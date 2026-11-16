import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { createRateLimiter } from "@/app/lib/rate-limit";
import { redeemHandoffCode } from "@/app/lib/web-handoff";
import { isDeletionPending } from "@/app/services/account-deletion.service";

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/**
 * POST /api/auth/web-handoff/redeem   body: { code }
 * Swaps a one-time code from the app for a normal website sign-in.
 * Returns the page to open next (fixed by the server when the code was made).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!limiter.check(ip)) return apiError(429, "Too many attempts. Please try again in a minute.");

    const body = await req.json().catch(() => ({}));
    const result = redeemHandoffCode(String(body?.code ?? ""));
    if (!result) return apiError(401, "This link has expired or was already used. Please try again from the app.");

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    });
    if (!user) return apiError(401, "Account not found.");
    if (await isDeletionPending(user.id)) return apiError(401, "This account is scheduled for deletion. Sign in again to restore it.");

    // The website is not device-limited, so this token has no device id.
    const token = signToken({ userId: user.id, email: user.email, role: user.role }, "365d");
    logger.info("web-handoff", "redeemed", { userId: user.id });
    return apiSuccess({ token, user, next: result.next });
  } catch (err) {
    logger.error("web-handoff", "redeem_failed", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not sign you in. Please try again.");
  }
}
