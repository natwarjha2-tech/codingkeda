import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { createHandoffCode, safeNext, HANDOFF_TTL_SEC } from "@/app/lib/web-handoff";

/**
 * POST /api/auth/web-handoff   body: { next: "/payment?courseId=…" }
 * Signed-in app → a one-time link that opens that website page already signed in.
 * The link works once and for 3 minutes.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    const next = safeNext(body?.next);
    if (!next) return apiError(400, "Invalid page.");
    const code = createHandoffCode(user!.userId, next);
    const site = process.env.WEB_HANDOFF_SITE_URL || "https://www.codingkida.com";
    return apiSuccess({
      url: `${site.replace(/\/$/, "")}/auth/handoff?code=${encodeURIComponent(code)}`,
      expiresInSec: HANDOFF_TTL_SEC,
    });
  } catch (err) {
    logger.error("web-handoff", "create_failed", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Could not open the page. Please try again.");
  }
}
