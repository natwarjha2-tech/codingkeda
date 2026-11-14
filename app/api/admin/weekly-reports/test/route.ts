import { NextRequest } from "next/server";
import { requireSuperAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { sendTestMessage } from "@/app/services/weekly-report.service";

/**
 * POST /api/admin/weekly-reports/test  (super-admin)
 * Body: { to: "+91 98765 43210" }
 * Sends ONE sample report to the given number (with made-up numbers) so the
 * WhatsApp setup can be checked. Nothing is saved. In dry-run mode it only
 * returns the text that would be sent.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireSuperAdmin(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    const to = String(body?.to ?? "").trim();
    if (!to) return apiError(400, "Enter a phone number to send the test to.");
    const r = await sendTestMessage(to);
    if (!r.ok) return apiError(400, r.error);
    return apiSuccess({ dryRun: r.dryRun, to: r.to, text: r.text });
  } catch {
    return apiError(500, "Could not send the test message.");
  }
}
