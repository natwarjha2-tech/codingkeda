/**
 * Coding exercise medals + coins (first solve only), like the quiz badges.
 *
 *  - Rank = how many students solved it before you + 1.
 *  - 1st: 🥇 Coding Gold, 10 coins · 2nd: 🥈 Coding Silver, 7 coins ·
 *    3rd–10th: 🥉 Coding Bronze, 5 coins · after that: no medal, no coins
 *    (the rank is still saved, and the XP is still earned).
 *  - Paid once per student per problem. Stored as a CoinTransaction with reason
 *    "CodingLB:<problemId> — Rank #N — <medal> — <title>".
 *  - A lock per student + problem stops two quick submits (or the desktop app's
 *    two calls) from paying twice.
 *
 * Used by POST /api/code/submit (server checked every test, so this is trusted)
 * and POST /api/coding-problems/leaderboard (desktop Code Arena).
 */
import { prisma } from "@/app/lib/prisma";
import { notifyCodingMedal } from "@/app/lib/notification";
import { logger } from "@/app/lib/logger";
import { codingMedal, type MedalInfo } from "@/app/lib/medals";
import { NOT_GUEST_USER } from "@/app/lib/guest";

export interface SolveReward {
  alreadyRanked: boolean;
  rank: number | null;
  coinsAwarded: number;
  medal: { key: string; label: string; icon: string } | null;
}

export async function awardSolveCoins(opts: {
  userId: string;
  problemId: string;
  problemTitle?: string | null;
  qualityTag?: string | null;
  lessonId?: string | null;
  courseId?: string | null;
}): Promise<SolveReward> {
  const { userId, problemId } = opts;
  const title = opts.problemTitle || "Problem";
  const tag = `CodingLB:${problemId}`;

  // Course · Module · Lesson for the transaction and the notification.
  let where: string | null = null;
  let courseId: string | null = opts.courseId || null;
  if (opts.lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: opts.lessonId },
      select: { title: true, module: { select: { title: true, courseId: true, course: { select: { title: true } } } } },
    });
    if (lesson) {
      where = [lesson.module?.course?.title, lesson.module?.title, lesson.title].filter(Boolean).join(" › ") || null;
      courseId = courseId || lesson.module?.courseId || null;
    }
  }

  let medal: MedalInfo | null = null;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${tag}`}))`;
    const existing = await tx.coinTransaction.findFirst({
      where: { userId, type: "EARNED", reason: { contains: tag } },
      select: { id: true },
    });
    if (existing) return { alreadyRanked: true, rank: null, coinsAwarded: 0, medal: null } as SolveReward;

    // Guests don't count: a visitor trying a lesson must never push a real student down a rank.
    const before = await tx.coinTransaction.count({ where: { type: "EARNED", reason: { contains: tag }, ...NOT_GUEST_USER } });
    const rank = before + 1;
    medal = codingMedal(rank);
    const coins = medal?.coins ?? 0;
    const reason = `${tag} — Rank #${rank}${medal ? ` — ${medal.label}` : ""} — ${title}`;

    if (coins > 0) {
      await tx.userCoins.upsert({
        where: { userId },
        update: { totalCoins: { increment: coins } },
        create: { userId, totalCoins: coins },
      });
    }
    await tx.coinTransaction.create({
      data: {
        userId, type: "EARNED", coins, reason,
        ...(opts.lessonId ? { lessonId: opts.lessonId } : {}),
        ...(courseId ? { courseId } : {}),
      },
    });
    return {
      alreadyRanked: false, rank, coinsAwarded: coins,
      medal: medal ? { key: medal.key, label: medal.label, icon: medal.icon } : null,
    } as SolveReward;
  });

  if (result.medal) {
    notifyCodingMedal({
      userId, key: `exercise:${problemId}`, medalLabel: result.medal.label, medalIcon: result.medal.icon,
      coins: result.coinsAwarded, problemTitle: title, where,
    }).catch((err) => logger.warn("exercise-coins", "notify_failed", { error: err instanceof Error ? err.message : "Unknown" }));
  }
  return result;
}
