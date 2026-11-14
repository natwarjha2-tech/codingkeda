import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/app/lib/logger";
import { optOutByNumber } from "@/app/services/weekly-report.service";

export const runtime = "nodejs";

/**
 * WhatsApp webhook (set in Meta → WhatsApp → Configuration).
 *
 * GET  — Meta's one-time verification (needs WHATSAPP_VERIFY_TOKEN).
 * POST — incoming events. Only used to honour opt-outs: if a parent replies
 *        STOP (or similar), consent for their child's weekly report is withdrawn.
 *        Every POST must carry a valid X-Hub-Signature-256 (WHATSAPP_APP_SECRET).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === expected) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = createHmac("sha256", secret).update(raw).digest("hex");
  const got = header.slice(7);
  if (want.length !== got.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

const STOP_WORDS = new Set(["stop", "unsubscribe", "cancel", "opt out", "optout", "no more", "band karo"]);

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const data = JSON.parse(raw) as {
      entry?: { changes?: { value?: { messages?: { from?: string; type?: string; text?: { body?: string } }[] } }[] }[];
    };
    for (const e of data.entry ?? []) {
      for (const c of e.changes ?? []) {
        for (const m of c.value?.messages ?? []) {
          const text = (m.text?.body ?? "").trim().toLowerCase();
          if (m.from && m.type === "text" && STOP_WORDS.has(text)) {
            const n = await optOutByNumber(m.from);
            logger.info("whatsapp", "opt_out", { students: n });
          }
        }
      }
    }
  } catch {
    // Never make Meta retry because of our parsing problem.
  }
  return new NextResponse("OK", { status: 200 });
}
