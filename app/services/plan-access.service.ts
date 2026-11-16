/**
 * Giving access after a paid plan.
 *
 *  - ZenAlpha: every active course marked "Include in ZenAlpha".
 *  - Single subject: that one course.
 *
 * Access lasts ACCESS_DAYS (3 months). Buying again while access is still on
 * adds 3 months to the current end date (no days are lost). Access that never
 * ends (older purchases, free/admin enrolments) is never shortened.
 */
import { prisma } from "@/app/lib/prisma";
import { ACCESS_DAYS, type PlanId } from "@/app/lib/pricing";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Active courses in the ZenAlpha plan. */
export async function zenAlphaCourses(): Promise<{ id: string; title: string }[]> {
  return prisma.course.findMany({
    where: { inZenAlpha: true, isActive: true },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
}

/** New end date for one course: 3 months from now, or from the current end if it is later. */
function nextEnd(current: Date | null | undefined, now: Date): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + ACCESS_DAYS * DAY_MS);
}

/** Give (or extend) 3 months of access to these courses. Returns the new end date. */
export async function grantPlanAccess(
  userId: string,
  courseIds: string[],
  source: PlanId,
  now: Date = new Date(),
): Promise<Date | null> {
  let latest: Date | null = null;
  for (const courseId of courseIds) {
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { expiresAt: true },
    });
    // Lifetime access (no end date) stays lifetime.
    if (existing && !existing.expiresAt) continue;
    const end = nextEnd(existing?.expiresAt, now);
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { expiresAt: end, source },
      create: { userId, courseId, expiresAt: end, source },
    });
    if (!latest || end > latest) latest = end;
  }
  return latest;
}
