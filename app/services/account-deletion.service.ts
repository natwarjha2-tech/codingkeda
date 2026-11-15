/**
 * Student account deletion — the way app stores and big platforms do it:
 *
 *  1. Ask: the student starts it inside the app/website (Settings → Delete
 *     account) and confirms with a 6-digit code sent to the account email
 *     (works for password, email-code and Google accounts alike).
 *  2. Grace period: the account is deactivated at once (all devices signed
 *     out) and deleted for good after GRACE_DAYS (30). Signing in again during
 *     that time cancels the deletion (like Facebook/Instagram/Microsoft).
 *  3. Erase: a cron job erases personal data: name, email, phone, parent
 *     details, school, birthday, photo, devices, notifications, chat text,
 *     submitted code. Payment records are KEPT (Indian tax law requires keeping
 *     invoices) but are then linked only to an anonymous user id. Anonymous
 *     learning statistics stay so other students' leaderboards don't change.
 *  4. Emails: confirmation when requested, when cancelled, and when done.
 *
 * Admin and super-admin accounts can't delete themselves here.
 */
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { sendEmail } from "@/app/lib/mail";
import { deleteFromS3, getS3KeyFromUrl, listAllObjects } from "@/app/lib/s3";
import { codesMatch, generateCode, hashCode, isSixDigits } from "@/app/lib/parent-verify";

const isStudentRole = (role: string | undefined) => role !== "admin" && role !== "super-admin";

export const GRACE_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const PURPOSE = "account-delete";

export class AccountDeletionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const secret = () => process.env.JWT_SECRET || "";
const esc = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" });

function mailShell(title: string, body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
      <h2 style="color:#6c47ff;margin:0 0 12px">${title}</h2>
      ${body}
      <p style="color:#64748b;font-size:12px;margin-top:24px">CodingKida</p>
    </div>`;
}

async function loadUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } });
  if (!user) throw new AccountDeletionError(404, "Account not found.");
  if (!isStudentRole(user.role)) throw new AccountDeletionError(403, "Admin accounts can't be deleted from here. Please contact the owner.");
  return user;
}

/** Status shown on the settings screen. */
export async function getDeletionStatus(userId: string) {
  const row = await prisma.accountDeletion.findUnique({ where: { userId } }).catch(() => null);
  return {
    pending: row?.status === "pending",
    scheduledFor: row?.status === "pending" && row.scheduledFor ? row.scheduledFor.toISOString() : null,
    graceDays: GRACE_DAYS,
  };
}

/** Step 1: email a 6-digit confirmation code to the account email. */
export async function sendDeletionCode(userId: string): Promise<{ sentTo: string }> {
  const user = await loadUser(userId);
  const now = new Date();
  const existing = await prisma.accountDeletion.findUnique({ where: { userId } });
  if (existing?.status === "pending") throw new AccountDeletionError(409, "Your account is already scheduled for deletion.");
  if (existing?.codeSentAt && now.getTime() - existing.codeSentAt.getTime() < RESEND_MS) {
    throw new AccountDeletionError(429, "Please wait a minute before asking for a new code.");
  }

  const code = generateCode();
  const codeHash = hashCode(code, userId, PURPOSE, secret());
  const data = { codeHash, codeExpiresAt: new Date(now.getTime() + CODE_TTL_MS), codeAttempts: 0, codeSentAt: now };
  await prisma.accountDeletion.upsert({
    where: { userId },
    create: { userId, status: "cancelled", ...data },
    update: data,
  });

  await sendEmail(
    user.email,
    "Your CodingKida account deletion code",
    mailShell(
      "Confirm account deletion",
      `<p>Hi ${esc(user.name || "there")},</p>
       <p>Use this code to confirm that you want to delete your CodingKida account:</p>
       <p style="font-size:28px;font-weight:bold;letter-spacing:6px;text-align:center">${code}</p>
       <p>The code expires in 10 minutes. If you didn't ask for this, ignore this email; your account stays as it is.</p>`,
    ),
  );
  const [name, domain] = user.email.split("@");
  return { sentTo: `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain ?? ""}` };
}

/** Step 2: check the code and schedule the deletion. Signs every device out. */
export async function requestDeletion(
  userId: string,
  input: { code: string; reason?: string; channel?: string },
): Promise<{ scheduledFor: string }> {
  const user = await loadUser(userId);
  const row = await prisma.accountDeletion.findUnique({ where: { userId } });
  if (row?.status === "pending") throw new AccountDeletionError(409, "Your account is already scheduled for deletion.");
  if (!row?.codeHash || !row.codeExpiresAt || row.codeExpiresAt.getTime() < Date.now()) {
    throw new AccountDeletionError(400, "The code has expired. Please ask for a new one.");
  }
  if (!isSixDigits(input.code)) throw new AccountDeletionError(400, "Enter the 6-digit code from the email.");
  if (!codesMatch(row.codeHash, input.code.trim(), userId, PURPOSE, secret())) {
    const attempts = row.codeAttempts + 1;
    await prisma.accountDeletion.update({
      where: { userId },
      data: attempts >= MAX_ATTEMPTS ? { codeAttempts: attempts, codeHash: null, codeExpiresAt: null } : { codeAttempts: attempts },
    });
    throw new AccountDeletionError(400, attempts >= MAX_ATTEMPTS ? "Too many wrong codes. Please ask for a new one." : "That code is not correct.");
  }

  const now = new Date();
  const scheduledFor = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.accountDeletion.update({
      where: { userId },
      data: {
        status: "pending", requestedAt: now, scheduledFor, cancelledAt: null,
        reason: String(input.reason ?? "").slice(0, 500), channel: String(input.channel ?? "").slice(0, 20),
        codeHash: null, codeExpiresAt: null, codeAttempts: 0,
      },
    }),
    // Sign out every device and stop push notifications.
    prisma.studentDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revokedBy: "account_deletion" } }),
    prisma.userDevice.updateMany({ where: { userId }, data: { active: false } }),
  ]);
  forgetDeletionCache(userId);
  logger.info("account-deletion", "requested", { userId });

  sendEmail(
    user.email,
    "Your CodingKida account will be deleted",
    mailShell(
      "Account deletion scheduled",
      `<p>Hi ${esc(user.name || "there")},</p>
       <p>Your CodingKida account will be permanently deleted on <b>${esc(fmtDate(scheduledFor))}</b>.
          You have been signed out of all devices.</p>
       <p><b>Changed your mind?</b> Just sign in again before that date and your account will be restored.</p>
       <p>After deletion, your profile, progress, coins, certificates and purchased courses can't be recovered.</p>`,
    ),
  ).catch(() => {});
  return { scheduledFor: scheduledFor.toISOString() };
}

/** Signing in during the grace period cancels the deletion. Returns true if it did. */
export async function cancelDeletionOnSignIn(userId: string): Promise<boolean> {
  try {
    const row = await prisma.accountDeletion.findUnique({ where: { userId }, select: { status: true } });
    if (row?.status !== "pending") return false;
    await prisma.accountDeletion.update({
      where: { userId },
      data: { status: "cancelled", cancelledAt: new Date(), scheduledFor: null, reason: "" },
    });
    forgetDeletionCache(userId);
    logger.info("account-deletion", "cancelled_by_sign_in", { userId });
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (u?.email) {
      sendEmail(
        u.email,
        "Your CodingKida account was restored",
        mailShell(
          "Account deletion cancelled",
          `<p>Hi ${esc(u.name || "there")},</p>
           <p>You signed in again, so your account will <b>not</b> be deleted. Everything is as it was.</p>
           <p>If this wasn't you, please change your password.</p>`,
        ),
      ).catch(() => {});
    }
    return true;
  } catch {
    return false; // never block a sign-in because of this
  }
}

// ── Per-request check: tokens of an account waiting for deletion stop working ─
const CACHE_MS = 60 * 1000;
const cache = new Map<string, { pending: boolean; at: number }>();
function forgetDeletionCache(userId: string) { cache.delete(userId); }

export async function isDeletionPending(userId: string): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && now - hit.at < CACHE_MS) return hit.pending;
  try {
    const row = await prisma.accountDeletion.findUnique({ where: { userId }, select: { status: true } });
    const pending = row?.status === "pending" || row?.status === "completed";
    cache.set(userId, { pending, at: now });
    return pending;
  } catch {
    return false; // fail open on DB problems
  }
}

// ── Erase (run by the cron job after the grace period) ──────────────────────
const anonEmail = (userId: string) => `deleted+${userId}@deleted.codingkida.invalid`;

async function eraseOne(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, avatarUrl: true } });
  if (!user) {
    await prisma.accountDeletion.update({ where: { userId }, data: { status: "completed", completedAt: new Date(), reason: "" } });
    return;
  }
  const oldEmail = user.email;
  const studentRow = await prisma.student.findUnique({ where: { userId }, select: { parentEmail: true } });

  // Farewell email first (the address is erased below).
  if (oldEmail && !oldEmail.endsWith("@deleted.codingkida.invalid")) {
    await sendEmail(
      oldEmail,
      "Your CodingKida account has been deleted",
      mailShell(
        "Account deleted",
        `<p>Hi ${esc(user.name || "there")},</p>
         <p>As you asked, your CodingKida account and personal data have now been deleted.
            Payment records are kept only where the law requires it, without your name or email.</p>
         <p>You are always welcome back with a new account.</p>`,
      ),
    ).catch(() => {});
  }

  const redacted = "[deleted]";
  const emails = [oldEmail, studentRow?.parentEmail].filter((e): e is string => !!e);
  await prisma.$transaction([
    // Personal profile → anonymous.
    prisma.user.update({
      where: { id: userId },
      data: {
        email: anonEmail(userId), name: "Deleted user", password: "", googleId: null,
        avatarUrl: null, referralCode: null,
      },
    }),
    prisma.student.updateMany({
      where: { userId },
      data: {
        name: "Deleted user", email: anonEmail(userId), phone: null,
        studentName: null, studentDob: null, studentGrade: null, studentGender: null, studentSchool: null,
        parentName: null, parentEmail: null, parentContact: null,
      },
    }),
    // Things keyed by the email address.
    prisma.emailOtp.deleteMany({ where: { email: { in: [oldEmail.toLowerCase(), oldEmail] } } }),
    prisma.passwordReset.deleteMany({ where: { email: { in: [oldEmail.toLowerCase(), oldEmail] } } }),
    prisma.surveyLead.deleteMany({ where: { email: { in: emails } } }),
    prisma.surveyResponse.deleteMany({ where: { email: { in: emails } } }),
    // Devices, notifications, parent WhatsApp data, links.
    prisma.studentDevice.deleteMany({ where: { userId } }),
    prisma.studentDeviceEvent.deleteMany({ where: { userId } }),
    prisma.userDevice.deleteMany({ where: { userId } }),
    prisma.notificationOutbox.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.parentPhoneVerification.deleteMany({ where: { userId } }),
    prisma.parentReportConsent.deleteMany({ where: { userId } }),
    prisma.weeklyReportLog.deleteMany({ where: { userId } }),
    prisma.enrollToken.deleteMany({ where: { userId } }),
    // Text the student wrote.
    prisma.lessonChatMessage.updateMany({ where: { senderId: userId }, data: { text: redacted } }),
    prisma.liveChatMessage.updateMany({ where: { senderId: userId }, data: { message: redacted } }),
    prisma.exerciseSubmission.updateMany({ where: { userId }, data: { code: "", output: null } }),
    prisma.weeklyStreakAttempt.updateMany({ where: { userId }, data: { answer: "", feedback: null } }),
    // Certificates no longer carry the name.
    prisma.certificate.updateMany({ where: { userId }, data: { studentName: "Deleted user" } }),
    prisma.accountDeletion.update({ where: { userId }, data: { status: "completed", completedAt: new Date(), reason: "" } }),
  ]);

  // Profile photos in S3 (current one + older uploads named avatars/<userId>-*).
  const keys = new Set<string>();
  const current = user.avatarUrl ? getS3KeyFromUrl(user.avatarUrl) : null;
  if (current) keys.add(current);
  try {
    for (const o of await listAllObjects(`avatars/${userId}-`)) keys.add(o.key);
  } catch { /* best effort */ }
  for (const k of keys) await deleteFromS3(k);

  forgetDeletionCache(userId);
  logger.info("account-deletion", "erased", { userId, photos: keys.size });
}

/** Erase every account whose grace period is over. Safe to call repeatedly. */
export async function purgeDueAccounts(limit = 50): Promise<{ erased: number; failed: number }> {
  const due = await prisma.accountDeletion.findMany({
    where: { status: "pending", scheduledFor: { lte: new Date() } },
    select: { userId: true },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });
  let erased = 0;
  let failed = 0;
  for (const d of due) {
    try {
      await eraseOne(d.userId);
      erased += 1;
    } catch (err) {
      failed += 1;
      logger.error("account-deletion", "erase_failed", { userId: d.userId, error: err instanceof Error ? err.message : "unknown" });
    }
  }
  return { erased, failed };
}
