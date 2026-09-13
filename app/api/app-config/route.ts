import { apiSuccess } from "@/app/lib/response";

/**
 * Public app configuration endpoint.
 *
 * Returns runtime-configurable values that clients (e.g. the desktop app)
 * can fetch without authentication. This lets us change values like the
 * support WhatsApp number from Vercel environment variables without
 * shipping a new desktop build.
 *
 * GET /api/app-config
 * Response: { success: true, supportWhatsapp: "<digits>" }
 */

// Fallbacks used only if the env vars are not configured. WhatsApp must be in
// international format (country code + number, digits only, no + or spaces).
const DEFAULT_SUPPORT_WHATSAPP = "919999999999";
const DEFAULT_SUPPORT_EMAIL = "support@codingkida.com";

export const dynamic = "force-dynamic";

export async function GET() {
  const supportWhatsapp = (process.env.SUPPORT_WHATSAPP || DEFAULT_SUPPORT_WHATSAPP)
    .replace(/[^0-9]/g, "");

  const supportEmail = (process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim();

  return apiSuccess({ supportWhatsapp, supportEmail });
}
