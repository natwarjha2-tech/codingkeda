/**
 * Pure helpers for parent-number verification (no database — easy to test).
 */
import { createHmac, randomInt, timingSafeEqual } from "crypto";

export const CODE_TTL_MS = 10 * 60 * 1000; // a code is valid for 10 minutes
export const MAX_ATTEMPTS = 5; // wrong guesses before the code is thrown away
export const RESEND_COOLDOWN_MS = 60 * 1000; // at least 1 minute between codes
export const MAX_SENDS_PER_DAY = 5; // codes per student per day
export const MAX_SENDS_PER_PHONE_PER_DAY = 10; // codes to one number per day (siblings share a parent)

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Today's date in IST, "YYYY-MM-DD" — the day key for the daily send counter. */
export function istDay(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** A random 6-digit code. */
export function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * HMAC of the code, bound to the student and the number, so a code can't be
 * reused for someone else and the database never holds the code itself.
 */
export function hashCode(code: string, userId: string, phone: string, secret: string): string {
  return createHmac("sha256", secret).update(`${userId}|${phone}|${code}`).digest("hex");
}

export function codesMatch(expectedHash: string, code: string, userId: string, phone: string, secret: string): boolean {
  const got = hashCode(String(code).trim(), userId, phone, secret);
  if (got.length !== expectedHash.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expectedHash));
}

export const isSixDigits = (s: string) => /^\d{6}$/.test(String(s).trim());
