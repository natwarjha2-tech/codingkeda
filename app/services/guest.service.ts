/**
 * Guest accounts: create, delete (on leave), and purge expired ones (daily cron).
 *
 * SAFETY — deletes only ever touch a guest:
 *  - every delete first re-reads the user from the database and refuses unless
 *    role === "guest" AND the email is on the reserved guest domain;
 *  - every query is scoped to that one user id;
 *  - a guest that somehow has a payment is never deleted (kept for the books).
 * Real students, admins and their data can't be reached by this code.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { GUEST_EMAIL_DOMAIN, GUEST_NAME, GUEST_ROLE, GUEST_TTL_MS, isGuestEmail } from "@/app/lib/guest";

/** New temporary student account (no password, no Student row, no welcome message). */
export async function createGuest() {
  return prisma.user.create({
    data: {
      email: `guest-${randomUUID()}${GUEST_EMAIL_DOMAIN}`,
      name: GUEST_NAME,
      password: "", // can't be used to sign in with a password
      role: GUEST_ROLE,
    },
    select: { id: true, email: true, name: true, role: true },
  });
}

/**
 * Remove one guest and everything it created.
 * Tables linked to User with onDelete: Cascade (progress, quiz attempts, coins,
 * achievements, notifications, …) go with the user row. The tables below only
 * store the id as text, so they are cleared explicitly first.
 * Returns false (and deletes nothing) when the id is not a guest.
 */
export async function deleteGuest(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true } });
  if (!u) return true; // already gone
  if (u.role !== GUEST_ROLE || !isGuestEmail(u.email)) {
    logger.warn("guest", "delete_refused_not_guest", { userId });
    return false;
  }
  if ((await prisma.payment.count({ where: { userId } })) > 0) {
    logger.warn("guest", "delete_refused_has_payment", { userId });
    return false;
  }

  const id = u.id;
  await prisma.$transaction([
    prisma.notificationOutbox.deleteMany({ where: { userId: id } }),
    prisma.enrollToken.deleteMany({ where: { userId: id } }),
    prisma.finalTestAttempt.deleteMany({ where: { userId: id } }),
    prisma.certificate.deleteMany({ where: { userId: id } }),
    prisma.parentReportConsent.deleteMany({ where: { userId: id } }),
    prisma.weeklyReportLog.deleteMany({ where: { userId: id } }),
    prisma.parentPhoneVerification.deleteMany({ where: { userId: id } }),
    prisma.parentConsent.deleteMany({ where: { userId: id } }),
    prisma.studentDevice.deleteMany({ where: { userId: id } }),
    prisma.studentDeviceEvent.deleteMany({ where: { userId: id } }),
    prisma.accountDeletion.deleteMany({ where: { userId: id } }),
    prisma.lessonChatMessage.deleteMany({ where: { senderId: id } }),
    prisma.liveChatReaction.deleteMany({ where: { userId: id } }),
    prisma.liveChatMessage.deleteMany({ where: { senderId: id } }),
    prisma.liveParticipant.deleteMany({ where: { userId: id } }),
    // Same guard again inside the statement: only a guest row can match.
    prisma.user.deleteMany({ where: { id, role: GUEST_ROLE, email: { endsWith: GUEST_EMAIL_DOMAIN } } }),
  ]);
  logger.info("guest", "deleted", { userId: id });
  return true;
}

/** Daily cleanup: remove guests whose 4-hour login has expired (closed the tab without leaving). */
export async function purgeExpiredGuests(batch = 200): Promise<{ deleted: number; skipped: number }> {
  const cutoff = new Date(Date.now() - GUEST_TTL_MS);
  let deleted = 0, skipped = 0;
  const seen = new Set<string>();
  for (let round = 0; round < 50; round++) {
    const rows = await prisma.user.findMany({
      where: { role: GUEST_ROLE, email: { endsWith: GUEST_EMAIL_DOMAIN }, createdAt: { lt: cutoff }, id: { notIn: [...seen] } },
      select: { id: true },
      take: batch,
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      seen.add(r.id);
      try { (await deleteGuest(r.id)) ? deleted++ : skipped++; }
      catch (err) { skipped++; logger.error("guest", "purge_one_failed", { userId: r.id, error: err instanceof Error ? err.message : "unknown" }); }
    }
  }
  return { deleted, skipped };
}
