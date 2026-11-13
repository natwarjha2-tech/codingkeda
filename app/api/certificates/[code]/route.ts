import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { FinalTestError, getCertificatePdfForOwner } from "@/app/services/final-test.service";

export const runtime = "nodejs";

/**
 * GET /api/certificates/[code]           → application/pdf (owner only)
 * GET /api/certificates/[code]?format=base64 → { base64, filename } (mobile)
 *
 * The PDF is generated on demand (never stored / no public URL). Only the
 * certificate's owner (or an admin) can fetch it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    const { code } = await params;
    const isAdmin = user!.role === "admin" || user!.role === "super-admin";
    const { pdf, filename } = await getCertificatePdfForOwner(user!.userId, decodeURIComponent(code), isAdmin);

    if (req.nextUrl.searchParams.get("format") === "base64") {
      return apiSuccess({ base64: Buffer.from(pdf).toString("base64"), filename });
    }
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // inline + no-store: shown inside the app, not cached by proxies.
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof FinalTestError) return apiError(err.status, err.message);
    logger.error("certificates", "pdf_error", { error: err instanceof Error ? err.message : "unknown" });
    return apiError(500, "Internal server error.");
  }
}
