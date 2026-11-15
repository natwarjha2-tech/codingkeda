/**
 * WhatsApp Business Cloud API sender (Meta). Server-side only.
 *
 * Env (never commit, never log):
 *   WHATSAPP_PHONE_NUMBER_ID     Phone number ID from Meta (not the phone number)
 *   WHATSAPP_ACCESS_TOKEN        access token (test token or permanent system-user token)
 *   WHATSAPP_TEMPLATE_NAME       approved weekly-report template (e.g. weekly_learning_report)
 *   WHATSAPP_TEMPLATE_LANG       its language code (default "en")
 *   WHATSAPP_OTP_TEMPLATE_NAME   approved AUTHENTICATION template used to verify a parent's number
 *   WHATSAPP_OTP_TEMPLATE_LANG   its language code (default "en")
 *   WHATSAPP_API_VERSION         Graph API version (default v25.0)
 *   WHATSAPP_DRY_RUN             anything except "false" → nothing is sent (default: dry run)
 *   WHATSAPP_DAILY_LIMIT         max different parents per rolling 24 h (default 250 =
 *                                Meta's limit for a new, unverified business)
 *   WHATSAPP_VERIFY_TOKEN        webhook verification string you choose
 *   WHATSAPP_APP_SECRET          Meta app secret (verifies webhook signatures)
 *   CRON_SECRET                  shared secret for the weekly cron call
 */
import { logger } from "@/app/lib/logger";

export function isDryRun(): boolean {
  return String(process.env.WHATSAPP_DRY_RUN ?? "true").toLowerCase() !== "false";
}

export function waConfigured(): boolean {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_TEMPLATE_NAME);
}

/** Can a verification code really be sent on WhatsApp right now? */
export function otpConfigured(): boolean {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_OTP_TEMPLATE_NAME);
}

// ── TEST MODE ───────────────────────────────────────────────────────────────
// Meta's free test account can only message 5 numbers that were verified in the
// Meta dashboard, and cannot hold custom templates. Setting WHATSAPP_TEST_ALLOWLIST
// (comma-separated numbers) switches the weekly report into TEST MODE:
//   • ONLY those numbers can ever be messaged (everyone else is ignored);
//   • those numbers count as verified + consenting (Meta verified them for you);
//   • students with no activity are still included so a test always sends;
//   • the same week can be re-sent for repeat tests.
// WHATSAPP_TEST_AS_TEXT=true additionally sends the real report text as a plain
// message instead of a template (works if the recipient messaged the test number
// in the last 24 hours). Leave BOTH unset in production.
export function testAllowlist(): string[] {
  return String(process.env.WHATSAPP_TEST_ALLOWLIST ?? "")
    .split(",")
    .map((s) => normalizeWhatsAppNumber(s.trim()))
    .filter((s): s is string => !!s);
}
export function isTestMode(): boolean {
  return testAllowlist().length > 0;
}
export function testAsText(): boolean {
  return isTestMode() && String(process.env.WHATSAPP_TEST_AS_TEXT ?? "").toLowerCase() === "true";
}

export function waSettings() {
  return {
    testMode: isTestMode(),
    testNumbers: testAllowlist().length,
    testAsText: testAsText(),
    configured: waConfigured(),
    otpConfigured: otpConfigured(),
    dryRun: isDryRun(),
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || "",
    language: process.env.WHATSAPP_TEMPLATE_LANG || "en",
    dailyLimit: Math.max(1, Number(process.env.WHATSAPP_DAILY_LIMIT) || 250),
  };
}

/**
 * "+91 98765 43210" / "09876543210" / "9876543210" → "919876543210".
 * Returns null when it doesn't look like a phone number (so we never message a
 * garbage number). Same rules as the mobile app.
 */
export function normalizeWhatsAppNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) return "91" + d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

export function maskNumber(num: string): string {
  return num.length > 4 ? `${"•".repeat(Math.max(0, num.length - 4))}${num.slice(-4)}` : num;
}

export type WaSendResult = { ok: true; id: string } | { ok: false; error: string; code?: number };

/** Meta's built-in "hello_world" template has no variables and uses en_US. */
function isHelloWorld(name: string) {
  return name === "hello_world";
}

/** POST one message to the Cloud API. The token is never logged. */
async function postMessage(to: string, body: Record<string, unknown>): Promise<WaSendResult> {
  // Tolerate stray spaces, quotes or line breaks pasted into .env.
  const clean = (v?: string) => (v ?? "").replace(/\s+/g, "").replace(/^["']+|["']+$/g, "");
  const phoneId = clean(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const token = clean(process.env.WHATSAPP_ACCESS_TOKEN);
  if (!phoneId || !token) return { ok: false, error: "WhatsApp is not configured on the server." };
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number; error_data?: { details?: string } };
    };
    if (res.ok && data.messages?.[0]?.id) return { ok: true, id: data.messages[0].id };
    const e = data.error;
    const msg = e?.error_data?.details || e?.message || `HTTP ${res.status}`;
    logger.error("whatsapp", "send_failed", { status: res.status, code: e?.code, to: maskNumber(to), error: String(msg).slice(0, 200) });
    return { ok: false, error: String(msg).slice(0, 300), code: e?.code };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    logger.error("whatsapp", "send_error", { to: maskNumber(to), error: aborted ? "timeout" : "network" });
    return { ok: false, error: aborted ? "Timed out talking to WhatsApp." : "Network error talking to WhatsApp." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Plain text message (no template). WhatsApp only delivers this inside the
 * 24-hour window after the recipient messaged you, so it is used for TEST MODE only.
 */
export async function sendWhatsAppText(to: string, text: string): Promise<WaSendResult> {
  if (!isTestMode()) return { ok: false, error: "Plain-text sending is only allowed in test mode." };
  if (!testAllowlist().includes(to)) return { ok: false, error: "That number is not on the test list." };
  return postMessage(to, { messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body: text.slice(0, 4000) } });
}

/** Send the weekly-report template. `params` fill {{1}}, {{2}}… in order. */
export async function sendWhatsAppTemplate(to: string, params: string[]): Promise<WaSendResult> {
  const name = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!name) return { ok: false, error: "WhatsApp is not configured on the server." };
  // Test mode is a hard fence: nothing outside the allow-list can be messaged.
  if (isTestMode() && !testAllowlist().includes(to)) return { ok: false, error: "That number is not on the test list." };
  const hello = isHelloWorld(name);
  return postMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: hello ? "en_US" : process.env.WHATSAPP_TEMPLATE_LANG || "en" },
      ...(!hello && params.length
        ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] }
        : {}),
    },
  });
}

/**
 * Send a one-time verification code with an AUTHENTICATION template.
 * Meta's authentication templates read "{{1}} is your verification code." and
 * carry a copy-code button, so the code goes into both the body and the button.
 */
export async function sendWhatsAppAuthCode(to: string, code: string): Promise<WaSendResult> {
  const name = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  if (!name) return { ok: false, error: "The verification template is not configured on the server." };
  if (isTestMode() && !testAllowlist().includes(to)) return { ok: false, error: "That number is not on the test list." };
  return postMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en" },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  });
}
