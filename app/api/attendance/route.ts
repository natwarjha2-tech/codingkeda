import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { checkStudentDevice } from "@/app/services/student-device.service";
import { checkParentConsent } from "@/app/services/parent-consent.service";

/**
 * Server-side per-day learning activity, so the "My Report" calendar can show
 * the full history (join month → now) across devices — not just the ~30 days
 * the apps keep locally.
 *
 * GET  /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   → { success, joinedAt, days: [{ date, minutes, sessions }, ...] }
 *   Returns all stored activity days for the user, optionally within [from,to].
 *   `joinedAt` (User.createdAt as YYYY-MM-DD) lets the client render months from
 *   the join month to now.
 *
 * POST /api/attendance   body: { date: "YYYY-MM-DD", minutes: number, sessions?: number }
 *   → upserts the day, ADDING minutes/sessions (capped) so repeated calls in a
 *   day accumulate. The client sends today's delta (or today's total — see cap).
 */

const MAX_DAILY_MINUTES = 1440; // never store more than a full day
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: { userId: string; date?: { gte?: string; lte?: string } } = {
      userId: user!.userId,
    };
    if ((from && DATE_RE.test(from)) || (to && DATE_RE.test(to))) {
      where.date = {};
      if (from && DATE_RE.test(from)) where.date.gte = from;
      if (to && DATE_RE.test(to)) where.date.lte = to;
    }

    const [days, dbUser] = await Promise.all([
      prisma.dailyActivity.findMany({
        where,
        select: { date: true, minutes: true, sessions: true },
        orderBy: { date: "asc" },
      }),
      prisma.user.findUnique({
        where: { id: user!.userId },
        select: { createdAt: true },
      }),
    ]);

    // Join date as YYYY-MM-DD (used by the client to build months join → now).
    const joinedAt = dbUser?.createdAt
      ? dbUser.createdAt.toISOString().slice(0, 10)
      : null;

    return apiSuccess({ joinedAt, days });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    // A replaced/unlinked device no longer adds learning time.
    const deviceError = await checkStudentDevice(user);
    if (deviceError) return deviceError;
    const consentError = await checkParentConsent(user);
    if (consentError) return consentError;

    const body = await req.json().catch(() => ({}));
    const date: string = String(body?.date || "");
    const minutes = Math.max(0, Math.floor(Number(body?.minutes) || 0));
    const sessions = Math.max(0, Math.floor(Number(body?.sessions) || 0));

    if (!DATE_RE.test(date)) {
      return apiError(400, "date must be YYYY-MM-DD.");
    }
    if (minutes <= 0 && sessions <= 0) {
      return apiSuccess({ ok: true, skipped: true }); // nothing to record
    }

    // Accumulate ATOMICALLY (the database adds the numbers), so two sends arriving
    // at the same moment (e.g. phone + desktop) can't overwrite each other.
    const where = { userId_date: { userId: user!.userId, date } };
    const add = Math.min(MAX_DAILY_MINUTES, minutes);
    let saved = await prisma.dailyActivity.upsert({
      where,
      create: { userId: user!.userId, date, minutes: add, sessions },
      update: { minutes: { increment: add }, sessions: { increment: sessions } },
      select: { date: true, minutes: true, sessions: true },
    });
    if (saved.minutes > MAX_DAILY_MINUTES) {
      saved = await prisma.dailyActivity.update({
        where,
        data: { minutes: MAX_DAILY_MINUTES },
        select: { date: true, minutes: true, sessions: true },
      });
    }

    return apiSuccess({ ok: true, day: saved });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
