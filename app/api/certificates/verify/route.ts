import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/app/lib/response";
import { verifyCertificate } from "@/app/services/final-test.service";

/**
 * GET /api/certificates/verify?code=CK-2026-XXXXXXXX   (public)
 * Lets anyone (e.g. a school) confirm a certificate printed code is genuine.
 * Returns only what is printed on the certificate itself.
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
    if (!code || !/^CK-\d{4}-[0-9A-F]{6,8}$/.test(code)) return apiError(400, "A valid certificate code is required.");
    return apiSuccess(await verifyCertificate(code));
  } catch {
    return apiError(500, "Internal server error.");
  }
}
