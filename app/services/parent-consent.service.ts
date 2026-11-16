/**
 * Parental consent.
 *
 * Who needs it: every student who is under 18, or whose date of birth is not on
 * file (so nobody under 18 can slip through by leaving it empty). A student who
 * is 18 or older needs nothing.
 *
 * What counts as "parent verified":
 *  - the parent EMAIL has been confirmed with a one-time code sent to it, and
 *  - the parent PHONE has been confirmed with a one-time code on WhatsApp
 *    (only required once WhatsApp sending is live, see consentSettings()).
 * Both only count while they equal the number / email saved on the student's
 * profile, so changing either one asks for a new check.
 *
 * When: students who sign up with a date of birth under 18 have to finish it
 * straight away. Everyone else (existing students, and email-code / Google
 * sign-ups) gets PARENT_CONSENT_GRACE_DAYS (default 14) from the first time we
 * look at their account. After that the learning screens return 403
 * PARENT_CONSENT_REQUIRED until the parent is verified.
 *
 * Fail-open: if the database can't be read, nobody is locked out.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { sendEmailChecked } from "@/app/lib/mail";
import { isValidEmail } from "@/app/lib/validation";
import { isMinorDob, ageFromDob } from "@/app/lib/age";
import { isDryRun, isTestMode, otpConfigured } from "@/app/lib/whatsapp";
import type { JwtPayload } from "@/app/lib/auth";
import {
  CODE_TTL_MS, MAX_ATTEMPTS, MAX_SENDS_PER_DAY, MAX_SENDS_PER_PHONE_PER_DAY, RESEND_COOLDOWN_MS,
  codesMatch, generateCode, hashCode, isSixDigits, istDay,
} from "@/app/lib/parent-verify";
import { getParentVerification } from "@/app/services/parent-verify.service";

export class ConsentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const secret = () => process.env.JWT_SECRET || "";
const PURPOSE = "parent-email";

export interface ConsentSettings {
  enabled: boolean;
  graceDays: number;
  /** Parent phone must be verified too (only once WhatsApp codes can really be delivered). */
  requirePhone: boolean;
}

export function consentSettings(): ConsentSettings {
  const days = Number(process.env.PARENT_CONSENT_GRACE_DAYS);
  const live = !isDryRun() && otpConfigured() && !isTestMode();
  const flag = process.env.PARENT_CONSENT_REQUIRE_PHONE;
  return {
    enabled: process.env.PARENT_CONSENT_ENABLED !== "false",
    graceDays: Number.isFinite(days) ? Math.min(90, Math.max(1, Math.floor(days))) : 14,
    requirePhone: flag === "true" ? true : flag === "false" ? false : live,
  };
}

const isStudentRole = (role?: string) => role !== "admin" && role !== "super-admin";
const normEmail = (v?: string | null) => String(v ?? "").trim().toLowerCase();

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(5, name.length - 1)))}@${domain}`;
}

export interface ConsentState {
  enabled: boolean;
  /** This student must have a verified parent (under 18, or age not on file). */
  required: boolean;
  reason: "minor" | "age_unknown" | "adult" | "off";
  age: number | null;
  dobMissing: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  phoneRequired: boolean;
  /** Phone codes are not really delivered yet (test mode): the app hides the phone step. */
  phoneTestMode: boolean;
  /** All required checks are done (or none are needed). */
  verified: boolean;
  deadlineAt: string | null;
  daysLeft: number | null;
  /** Deadline passed and still not verified: the app must show the verification screen first. */
  blocked: boolean;
  /** What the student saved so far, to pre-fill the form. */
  studentDob: string | null;
  parentName: string | null;
  parentEmail: string | null;
  parentEmailMasked: string | null;
  parentContact: string | null;
  parentPhoneLast4: string | null;
}

export async function getConsentState(userId: string, now: Date = new Date()): Promise<ConsentState> {
  const s = consentSettings();
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { studentDob: true, parentName: true, parentEmail: true, parentContact: true },
  });
  const email = normEmail(student?.parentEmail);
  const base = {
    enabled: s.enabled,
    phoneRequired: s.requirePhone,
    studentDob: student?.studentDob ?? null,
    parentName: student?.parentName ?? null,
    parentEmail: student?.parentEmail ?? null,
    parentEmailMasked: email ? maskEmail(email) : null,
    parentContact: student?.parentContact ?? null,
  };

  if (!s.enabled) {
    return {
      ...base, required: false, reason: "off", age: null, dobMissing: false, emailVerified: false, phoneVerified: false,
      phoneTestMode: false, verified: true, deadlineAt: null, daysLeft: null, blocked: false, parentPhoneLast4: null,
    };
  }

  const minor = isMinorDob(student?.studentDob, now);
  const age = ageFromDob(student?.studentDob, now);
  const required = minor !== false;

  if (!required) {
    return {
      ...base, required: false, reason: "adult", age, dobMissing: false, emailVerified: false, phoneVerified: false,
      phoneTestMode: false, verified: true, deadlineAt: null, daysLeft: null, blocked: false, parentPhoneLast4: null,
    };
  }

  const row = await prisma.parentConsent.findUnique({ where: { userId } });
  const emailVerified = !!email && !!row?.verifiedEmail && row.verifiedEmail === email;
  const pv = await getParentVerification(userId, now);
  const phoneVerified = pv.verified;
  const verified = emailVerified && (!s.requirePhone || phoneVerified);

  // The deadline starts the first time we see an account that needs a parent check.
  let deadline: Date | null = row?.deadlineAt ?? null;
  if (!verified && !deadline) {
    deadline = new Date(now.getTime() + s.graceDays * DAY_MS);
    try {
      await prisma.parentConsent.upsert({ where: { userId }, create: { userId, deadlineAt: deadline }, update: { deadlineAt: deadline } });
    } catch (err) {
      logger.error("parent-consent", "deadline_save_failed", { userId, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  const daysLeft = !verified && deadline ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS)) : null;
  const blocked = !verified && !!deadline && deadline.getTime() <= now.getTime();

  return {
    ...base,
    required: true,
    reason: minor === true ? "minor" : "age_unknown",
    age,
    dobMissing: minor === null,
    emailVerified,
    phoneVerified,
    phoneTestMode: pv.testMode,
    verified,
    deadlineAt: deadline ? deadline.toISOString() : null,
    daysLeft,
    blocked,
    parentPhoneLast4: pv.phoneLast4,
  };
}

/** New under-18 sign-ups have to finish the parent check right away (no grace days). */
export async function requireConsentNow(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.parentConsent.upsert({
    where: { userId },
    create: { userId, deadlineAt: now },
    update: { deadlineAt: now },
  });
  forgetConsent(userId);
}

// ── Parent email code ───────────────────────────────────────────────────────

export async function sendParentEmailCode(userId: string, now: Date = new Date()) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { name: true, studentName: true, email: true, parentEmail: true },
  });
  const to = normEmail(student?.parentEmail);
  if (!to || !isValidEmail(to)) throw new ConsentError(400, "Save a valid parent email first, then tap Verify.");
  if (to === normEmail(student?.email)) {
    throw new ConsentError(400, "The parent email must be different from your own email.");
  }

  const day = istDay(now);
  const row = await prisma.parentConsent.findUnique({ where: { userId } });
  const sendsToday = row && row.sendsDay === day ? row.sendsToday : 0;
  if (row?.lastSentAt && now.getTime() - row.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new ConsentError(429, "Please wait a minute before asking for another code.");
  }
  if (sendsToday >= MAX_SENDS_PER_DAY) throw new ConsentError(429, "Too many codes today. Please try again tomorrow.");
  const sameEmail = await prisma.parentConsent.aggregate({
    where: { email: to, sendsDay: day, NOT: { userId } },
    _sum: { sendsToday: true },
  });
  if ((sameEmail._sum.sendsToday ?? 0) + sendsToday >= MAX_SENDS_PER_PHONE_PER_DAY) {
    throw new ConsentError(429, "Too many codes were requested for this email today. Please try again tomorrow.");
  }

  const code = generateCode();
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const child = esc(student?.studentName || student?.name || "your child");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
      <h2 style="color:#6c47ff;margin:0 0 12px">Confirm you are the parent or guardian</h2>
      <p><b>${child}</b> has signed up for CodingKida, an online learning platform for children.
         Because the student is under 18, we need a parent or guardian to confirm.</p>
      <p>Your confirmation code is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
      <p>The code works for 10 minutes. Please give it to ${child} only if you agree to them using CodingKida
         and to us handling their data as described in our
         <a href="https://www.codingkida.com/privacy">Privacy Policy</a>.</p>
      <p style="color:#64748b;font-size:13px">If you don't know about this sign-up, ignore this email. Nothing will be activated.</p>
    </div>`;
  const sent = await sendEmailChecked(to, "CodingKida: confirm you are the parent or guardian", html);
  if (!sent) throw new ConsentError(502, "We couldn't send the email. Please check the address and try again.");

  const data = {
    email: to,
    codeHash: hashCode(code, userId, `${PURPOSE}:${to}`, secret()),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    attempts: 0,
    sendsDay: day,
    sendsToday: sendsToday + 1,
    lastSentAt: now,
  };
  await prisma.parentConsent.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  logger.info("parent-consent", "email_code_sent", { userId });
  return { sentTo: maskEmail(to), expiresInSec: Math.round(CODE_TTL_MS / 1000) };
}

export async function confirmParentEmailCode(userId: string, rawCode: string, now: Date = new Date()) {
  if (!isSixDigits(rawCode)) throw new ConsentError(400, "Enter the 6-digit code.");
  const student = await prisma.student.findUnique({ where: { userId }, select: { parentEmail: true } });
  const to = normEmail(student?.parentEmail);
  if (!to) throw new ConsentError(400, "Save a valid parent email first.");

  const row = await prisma.parentConsent.findUnique({ where: { userId } });
  if (!row || !row.codeHash || !row.expiresAt) throw new ConsentError(400, "Ask for a new code first.");
  if (row.email !== to) throw new ConsentError(400, "The parent email was changed. Ask for a new code.");
  if (row.expiresAt <= now) throw new ConsentError(400, "That code has expired. Ask for a new one.");
  if (row.attempts >= MAX_ATTEMPTS) throw new ConsentError(429, "Too many wrong tries. Ask for a new code.");

  if (!codesMatch(row.codeHash, rawCode, userId, `${PURPOSE}:${to}`, secret())) {
    const attempts = row.attempts + 1;
    await prisma.parentConsent.update({
      where: { userId },
      data: attempts >= MAX_ATTEMPTS ? { attempts, codeHash: null, expiresAt: null } : { attempts },
    });
    throw new ConsentError(400, attempts >= MAX_ATTEMPTS ? "Too many wrong tries. Ask for a new code." : "That code isn't right. Check and try again.");
  }

  await prisma.parentConsent.update({
    where: { userId },
    data: { verifiedEmail: to, verifiedAt: now, codeHash: null, expiresAt: null, attempts: 0 },
  });
  forgetConsent(userId);
  logger.success("parent-consent", "email_verified", { userId });
  return { verified: true };
}

// ── Access check (used by the learning routes) ──────────────────────────────

const OK_MS = 60 * 1000;
const okCache = new Map<string, number>();

/** Call after anything that can change the answer (verify, edit parent details). */
export function forgetConsent(userId: string): void {
  okCache.delete(userId);
}

/** 403 when the student must verify a parent first; null when fine (or when we can't tell). */
export async function checkParentConsent(user: JwtPayload | null | undefined): Promise<NextResponse | null> {
  if (!user || !isStudentRole(user.role)) return null;
  const now = Date.now();
  const hit = okCache.get(user.userId);
  if (hit && now - hit < OK_MS) return null;
  try {
    const state = await getConsentState(user.userId);
    if (!state.blocked) {
      okCache.set(user.userId, now);
      return null;
    }
    return NextResponse.json(
      {
        success: false,
        code: "PARENT_CONSENT_REQUIRED",
        message: "Your parent or guardian must be verified before you can continue. Open Parent verification and finish the steps.",
      },
      { status: 403 },
    );
  } catch (err) {
    logger.error("parent-consent", "check_failed", { userId: user.userId, error: err instanceof Error ? err.message : "unknown" });
    return null; // never lock students out because of a database problem
  }
}
