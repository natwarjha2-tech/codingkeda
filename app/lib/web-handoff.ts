/**
 * One-time sign-in codes so the apps can open a website page (for example the
 * payment page) with the student already signed in, without putting the real
 * login token in a URL.
 *
 *  - A code is a signed token with purpose "web-handoff", valid for 3 minutes.
 *  - It works ONCE: used codes are remembered (in memory, until they expire).
 *  - The page to open (`next`) is fixed inside the code by the server, so a
 *    code can't be reused to send someone to another site.
 */
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const SECRET = process.env.JWT_SECRET || "";
const PURPOSE = "web-handoff";
export const HANDOFF_TTL_SEC = 180;

interface HandoffClaims { purpose: string; sub: string; next: string; jti: string }

// jti → expiry time (ms). One process on EC2, so memory is enough for 3-minute codes.
const used = new Map<string, number>();
function sweep(now: number) {
  for (const [k, exp] of used) if (exp <= now) used.delete(k);
}

/** Only pages on our own site: "/payment?courseId=…" yes; "//evil.com" or "https://…" no. */
export function safeNext(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.length > 500) return null;
  if (/[\r\n]/.test(s)) return null;
  return s;
}

export function createHandoffCode(userId: string, next: string): string {
  return jwt.sign({ purpose: PURPOSE, next } as object, SECRET, {
    algorithm: "HS256",
    expiresIn: HANDOFF_TTL_SEC,
    subject: userId,
    jwtid: randomUUID(),
  });
}

/** The user id and page for a valid, unused code; null otherwise. Marks the code as used. */
export function redeemHandoffCode(code: string): { userId: string; next: string } | null {
  let claims: HandoffClaims & { exp?: number };
  try {
    claims = jwt.verify(code, SECRET, { algorithms: ["HS256"] }) as HandoffClaims & { exp?: number };
  } catch {
    return null;
  }
  if (claims.purpose !== PURPOSE || !claims.sub || !claims.jti) return null;
  const now = Date.now();
  sweep(now);
  if (used.has(claims.jti)) return null;
  used.set(claims.jti, (claims.exp ?? Math.floor(now / 1000) + HANDOFF_TTL_SEC) * 1000);
  const next = safeNext(claims.next) ?? "/dashboard";
  return { userId: claims.sub, next };
}
