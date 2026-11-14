/**
 * Verify a student's parent WhatsApp number with a one-time code.
 *
 * Flow: the student saves the parent's number → "Verify" sends a 6-digit code
 * to THAT number on WhatsApp → the parent reads it out → the student types it
 * in. This proves the number is real, is on WhatsApp, and the parent knows.
 * Only verified numbers are ever sent the weekly report.
 *
 * A verification only counts while it equals the student's CURRENT parent
 * number, so editing the number invalidates it. A code that was never really
 * delivered (dry run / test mode) never counts as verified for live sending.
 */
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import {
  isDryRun, maskNumber, normalizeWhatsAppNumber, otpConfigured, sendWhatsAppAuthCode,
} from "@/app/lib/whatsapp";
import {
  CODE_TTL_MS, MAX_ATTEMPTS, MAX_SENDS_PER_DAY, MAX_SENDS_PER_PHONE_PER_DAY, RESEND_COOLDOWN_MS,
  codesMatch, generateCode, hashCode, isSixDigits, istDay,
} from "@/app/lib/parent-verify";
import { setParentReportConsent } from "@/app/services/weekly-report.service";

export class ParentVerifyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const secret = () => process.env.JWT_SECRET || ""; // ≥32 chars, enforced at startup by auth.ts

async function currentParentNumber(userId: string): Promise<string | null> {
  const s = await prisma.student.findUnique({ where: { userId }, select: { parentContact: true } });
  return normalizeWhatsAppNumber(s?.parentContact);
}

export interface ParentVerificationState {
  hasNumber: boolean;
  phoneLast4: string | null;
  verified: boolean;
  pending: boolean; // a code was sent and hasn't expired
  /** Test mode: codes are not really sent, so nothing counts for live sending. */
  testMode: boolean;
}

/** What the app shows. `verified` is true only for the number currently saved. */
export async function getParentVerification(userId: string, now: Date = new Date()): Promise<ParentVerificationState> {
  const to = await currentParentNumber(userId);
  const testMode = isDryRun() || !otpConfigured();
  if (!to) return { hasNumber: false, phoneLast4: null, verified: false, pending: false, testMode };
  let row = null;
  try { row = await prisma.parentPhoneVerification.findUnique({ where: { userId } }); } catch { /* table not migrated yet */ }
  const matches = !!row && row.verifiedPhone === to;
  // A verification done in test mode is shown as verified only while still in test mode.
  const verified = matches && (row!.live || testMode);
  const pending = !!row && !!row.codeHash && row.phone === to && !!row.expiresAt && row.expiresAt > now;
  return { hasNumber: true, phoneLast4: to.slice(-4), verified, pending, testMode };
}

/** Send a code to the parent number currently saved on the student's profile. */
export async function sendParentCode(userId: string, now: Date = new Date()) {
  const to = await currentParentNumber(userId);
  if (!to) throw new ParentVerifyError(400, "Save a valid parent WhatsApp number first, then tap Verify.");

  const day = istDay(now);
  const row = await prisma.parentPhoneVerification.findUnique({ where: { userId } });
  const sendsToday = row && row.sendsDay === day ? row.sendsToday : 0;

  if (row?.lastSentAt && now.getTime() - row.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new ParentVerifyError(429, "Please wait a minute before asking for another code.");
  }
  if (sendsToday >= MAX_SENDS_PER_DAY) {
    throw new ParentVerifyError(429, "Too many codes today. Please try again tomorrow.");
  }
  const sameNumber = await prisma.parentPhoneVerification.aggregate({
    where: { phone: to, sendsDay: day, NOT: { userId } },
    _sum: { sendsToday: true },
  });
  if ((sameNumber._sum.sendsToday ?? 0) + sendsToday >= MAX_SENDS_PER_PHONE_PER_DAY) {
    throw new ParentVerifyError(429, "Too many codes were requested for this number today. Please try again tomorrow.");
  }

  const code = generateCode();
  const live = !isDryRun() && otpConfigured();
  if (live) {
    const r = await sendWhatsAppAuthCode(to, code);
    if (!r.ok) {
      logger.error("parent-verify", "send_failed", { userId, error: r.error.slice(0, 120) });
      throw new ParentVerifyError(502, "We couldn't send the code. Please check the number is on WhatsApp and try again.");
    }
  }

  const data = {
    phone: to,
    codeHash: hashCode(code, userId, to, secret()),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    attempts: 0,
    live,
    sendsDay: day,
    sendsToday: sendsToday + 1,
    lastSentAt: now,
  };
  await prisma.parentPhoneVerification.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  logger.info("parent-verify", "code_sent", { userId, live, to: maskNumber(to) });

  return {
    sentTo: maskNumber(to),
    expiresInSec: Math.round(CODE_TTL_MS / 1000),
    // Test mode only: nothing was sent to anyone, so the code is shown to let the flow be tried.
    devCode: live ? undefined : code,
    testMode: !live,
  };
}

/** Check the code the student typed. On success the number is verified and consent is switched on. */
export async function confirmParentCode(userId: string, rawCode: string, now: Date = new Date()) {
  if (!isSixDigits(rawCode)) throw new ParentVerifyError(400, "Enter the 6-digit code.");
  const to = await currentParentNumber(userId);
  if (!to) throw new ParentVerifyError(400, "Save a valid parent WhatsApp number first.");

  const row = await prisma.parentPhoneVerification.findUnique({ where: { userId } });
  if (!row || !row.codeHash || !row.expiresAt) throw new ParentVerifyError(400, "Ask for a new code first.");
  if (row.phone !== to) throw new ParentVerifyError(400, "The parent number was changed. Ask for a new code.");
  if (row.expiresAt <= now) throw new ParentVerifyError(400, "That code has expired. Ask for a new one.");
  if (row.attempts >= MAX_ATTEMPTS) throw new ParentVerifyError(429, "Too many wrong tries. Ask for a new code.");

  if (!codesMatch(row.codeHash, rawCode, userId, to, secret())) {
    const attempts = row.attempts + 1;
    await prisma.parentPhoneVerification.update({
      where: { userId },
      // After too many wrong guesses the code is thrown away.
      data: attempts >= MAX_ATTEMPTS ? { attempts, codeHash: null, expiresAt: null } : { attempts },
    });
    throw new ParentVerifyError(400, attempts >= MAX_ATTEMPTS ? "Too many wrong tries. Ask for a new code." : "That code isn't right. Check and try again.");
  }

  await prisma.parentPhoneVerification.update({
    where: { userId },
    data: { verifiedPhone: to, verifiedAt: now, codeHash: null, expiresAt: null, attempts: 0 },
  });
  // The parent just gave the code, so the weekly report is switched on (the student can still turn it off).
  await setParentReportConsent(userId, true, "verified");
  logger.success("parent-verify", "verified", { userId, live: row.live });
  return { verified: true, live: row.live };
}
