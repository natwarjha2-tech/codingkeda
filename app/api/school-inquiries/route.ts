import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/app/lib/response";
import { createRateLimiter } from "@/app/lib/rate-limit";
import { sendEmailChecked, sendEmail } from "@/app/lib/mail";
import { logger } from "@/app/lib/logger";

/**
 * POST /api/school-inquiries — "Request a demo" form on /for-schools.
 *
 * Validates the form, then emails the team (SCHOOL_LEADS_EMAIL, else
 * SUPPORT_EMAIL, else support@codingkida.com) and sends a confirmation to the
 * requester. Nothing is written to the database yet: a SchoolInquiry table
 * needs approval first. If the team email cannot be sent, the request fails,
 * so a lead is never silently lost.
 */

const limiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }); // 5 per hour per IP

const TEAM_EMAIL = process.env.SCHOOL_LEADS_EMAIL || process.env.SUPPORT_EMAIL || "support@codingkida.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
    if (!limiter.check(`school:${ip}`)) return apiError(429, "Too many requests. Please try again later.");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return apiError(400, "Invalid request.");

    // Honeypot: real people never fill this hidden field.
    if (str(body.website, 200)) return apiSuccess({ received: true });

    const lead = {
      school: str(body.school, 150),
      contact: str(body.contact, 100),
      email: str(body.email, 150).toLowerCase(),
      phone: str(body.phone, 20),
      city: str(body.city, 80),
      grades: str(body.grades, 80),
      students: Math.max(0, Math.min(100000, Math.floor(Number(body.students) || 0))),
      message: str(body.message, 2000),
      consent: body.consent === true,
    };

    const errors: string[] = [];
    if (lead.school.length < 2) errors.push("school name");
    if (lead.contact.length < 2) errors.push("your name");
    if (!EMAIL_RE.test(lead.email)) errors.push("a valid email");
    if (!/^\+?[0-9 ()-]{7,20}$/.test(lead.phone)) errors.push("a valid phone number");
    if (lead.city.length < 2) errors.push("city");
    if (!lead.grades) errors.push("classes");
    if (!lead.consent) errors.push("your consent to be contacted");
    if (errors.length) return apiError(400, `Please add ${errors.join(", ")}.`);

    const rows: [string, string][] = [
      ["School", lead.school], ["Contact person", lead.contact], ["Email", lead.email], ["Phone", lead.phone],
      ["City", lead.city], ["Classes", lead.grades], ["Estimated students", lead.students ? String(lead.students) : "—"],
      ["Message", lead.message || "—"], ["Submitted", new Date().toISOString()],
    ];
    const teamHtml = `<h2>New school demo request</h2><table cellpadding="6" style="border-collapse:collapse">${rows
      .map(([k, v]) => `<tr><td style="font-weight:bold;border:1px solid #ddd">${esc(k)}</td><td style="border:1px solid #ddd">${esc(v).replace(/\n/g, "<br>")}</td></tr>`)
      .join("")}</table>`;

    const sent = await sendEmailChecked(TEAM_EMAIL, `School demo request: ${lead.school.replace(/[\r\n]/g, " ")} (${lead.city.replace(/[\r\n]/g, " ")})`, teamHtml);
    if (!sent) {
      logger.error("school-inquiry", "team_email_failed", { school: lead.school });
      return apiError(502, "We could not send your request right now. Please try again in a few minutes.");
    }

    // Confirmation to the requester (best effort).
    sendEmail(
      lead.email,
      "We received your CodingKida demo request",
      `<p>Hi ${esc(lead.contact)},</p><p>Thank you for your interest in CodingKida for <b>${esc(lead.school)}</b>. Our team will contact you within 2 working days to set up a demo.</p><p>— Team CodingKida</p>`,
    ).catch(() => {});

    logger.info("school-inquiry", "received", { city: lead.city, students: lead.students });
    return apiSuccess({ received: true }, 201);
  } catch (err) {
    logger.error("school-inquiry", "unhandled_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
