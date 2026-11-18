/**
 * Weekly Coding Challenge: one logic program per week, the same for every student.
 *
 *  - Picked from the coding exercises that already exist (C, C++, Java, Python
 *    — this covers the C / Java / Python / DSA courses) and have test cases.
 *  - The pick is fixed for the week (Monday to Sunday, India time), so every
 *    student gets the same question and it changes every Monday.
 *  - Passing every test case gives 10 coins, once per week.
 *  - The reward is stored as a CoinTransaction with reason "WeeklyCode:<week> …",
 *    which is also what the weekly leaderboard reads. No new tables.
 */
import { createHash } from "crypto";
import { prisma } from "@/app/lib/prisma";

export const WEEKLY_CODE_COINS = 10;
const LANGS = ["c", "cpp", "java", "python"];
const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The week we are in (India time): key like "2026-W40", plus its Monday and Sunday. */
export function currentWeek(now: Date = new Date()) {
  const ist = new Date(now.getTime() + IST_MS);
  // ISO week: Monday is day 1.
  const day = ist.getUTCDay() || 7;
  const monday = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - (day - 1)));
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  const key = `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { key, start: iso(monday), end: iso(sunday) };
}

export const reasonPrefix = (weekKey: string) => `WeeklyCode:${weekKey}`;

/** This week's exercise (same for everyone), or null if no coding exercise with tests exists. */
export async function weeklyExercise(weekKey: string) {
  const pool = await prisma.exercise.findMany({
    where: {
      type: "coding",
      language: { in: LANGS },
      testCases: { some: {} },
      lesson: { module: { course: { isActive: true } } },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (pool.length === 0) return null;
  const n = parseInt(createHash("sha256").update(`weekly-code:${weekKey}`).digest("hex").slice(0, 8), 16);
  const id = pool[n % pool.length].id;
  return prisma.exercise.findUnique({
    where: { id },
    select: {
      id: true, title: true, description: true, difficulty: true, language: true, starterCode: true,
      inputFormat: true, outputFormat: true, constraints: true, hints: true,
      lessonId: true,
      lesson: { select: { module: { select: { courseId: true, course: { select: { title: true } } } } } },
      testCases: { where: { isHidden: false }, orderBy: { order: "asc" }, take: 3, select: { input: true, expectedOutput: true } },
    },
  });
}

/** Has this student already earned this week's reward? */
export async function solvedThisWeek(userId: string, weekKey: string) {
  const row = await prisma.coinTransaction.findFirst({
    where: { userId, type: "EARNED", reason: { startsWith: reasonPrefix(weekKey) } },
    select: { createdAt: true, coins: true },
  });
  return row;
}

/** Give the weekly reward once. Returns the coins given (0 if already given). */
export async function awardWeekly(userId: string, weekKey: string, exerciseTitle: string, courseId: string | null) {
  // Serialise per student + week so two quick submits can't both pay.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${weekKey}`}))`;
    const already = await tx.coinTransaction.findFirst({
      where: { userId, type: "EARNED", reason: { startsWith: reasonPrefix(weekKey) } },
      select: { id: true },
    });
    if (already) return 0;
    await tx.userCoins.upsert({
      where: { userId },
      update: { totalCoins: { increment: WEEKLY_CODE_COINS } },
      create: { userId, totalCoins: WEEKLY_CODE_COINS },
    });
    await tx.coinTransaction.create({
      data: {
        userId, type: "EARNED", coins: WEEKLY_CODE_COINS,
        reason: `${reasonPrefix(weekKey)} — Weekly Coding Challenge — ${exerciseTitle}`,
        ...(courseId ? { courseId } : {}),
      },
    });
    return WEEKLY_CODE_COINS;
  });
}

/** Who solved the challenge this week (first solver first) + how many weeks each has solved in total. */
export async function weeklyLeaderboard(weekKey: string, currentUserId: string | null) {
  const rows = await prisma.coinTransaction.findMany({
    where: { type: "EARNED", reason: { startsWith: reasonPrefix(weekKey) } },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const solvers = rows.filter((r) => (seen.has(r.userId) ? false : (seen.add(r.userId), true)));
  const top = solvers.slice(0, 50);
  const ids = top.map((r) => r.userId);
  const [users, totals] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    ids.length
      ? prisma.coinTransaction.groupBy({
          by: ["userId"],
          where: { userId: { in: ids }, type: "EARNED", reason: { startsWith: "WeeklyCode:" } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { userId: string; _count: { _all: number } }[]),
  ]);
  const name = new Map(users.map((u) => [u.id, u.name]));
  const weeks = new Map(totals.map((t) => [t.userId, t._count._all]));
  const leaderboard = top.map((r, i) => ({
    rank: i + 1,
    name: name.get(r.userId) || "Student",
    solvedAt: r.createdAt.toISOString(),
    weeksSolved: weeks.get(r.userId) ?? 1,
    isCurrentUser: r.userId === currentUserId,
  }));
  const idx = currentUserId ? solvers.findIndex((r) => r.userId === currentUserId) : -1;
  return {
    leaderboard,
    totalSolvers: solvers.length,
    currentUserRank: idx >= 0 ? { rank: idx + 1, totalSolvers: solvers.length } : null,
  };
}
