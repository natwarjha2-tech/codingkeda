import { prisma } from "@/app/lib/prisma";
import { notifyAchievement, notifyBadgeLost } from "@/app/lib/notification";

/**
 * Quiz Leaderboard Service
 * 
 * Encapsulates the business logic for:
 * - Calculating quiz rankings per lesson
 * - Awarding coins based on rank
 * - Preventing duplicate awards
 * - Creating achievements
 * 
 * Ranking criteria (in priority order):
 * 1. Score % (correct/total) DESC
 * 2. Correct count DESC
 * 3. Total time ASC (faster = better)
 * 4. Earliest submission ASC (first to achieve = better)
 * 
 * Coin rewards:
 * - Rank 1: 10 coins + "Super Master" badge
 * - Rank 2: 7 coins + "Master" badge
 * - Rank 3-10: 5 coins + "Pro" badge
 * - Rank 11+: No coins
 */

/** Minimum quiz score (%) needed to be ranked and win a medal or coins. */
export const QUIZ_PASS_PERCENT = 60;

const BADGE_BY_RANK = (rank: number): { type: string; title: string } | null =>
  rank === 1 ? { type: "super-master", title: "Quiz Gold" }
  : rank === 2 ? { type: "master", title: "Quiz Silver" }
  : rank >= 3 && rank <= 10 ? { type: "pro", title: "Quiz Bronze" }
  : null;
const BADGE_STRENGTH: Record<string, number> = { "super-master": 1, master: 2, pro: 3 };

export interface LeaderboardResult {
  rank: number | null;
  coinsAwarded: number;
  badge: string | null;
}

/**
 * Re-sync the quiz badge of every student in this lesson EXCEPT `skipUserId`,
 * using the order in `rankedUserIds` (best first, pass mark already applied).
 * Badges only change here; coins already paid are never taken back.
 */
async function syncOtherBadges(skipUserId: string, lessonId: string, courseId: string, rankedUserIds: string[]) {
  const existing = await prisma.achievement.findMany({
    where: { lessonId },
    select: { userId: true, badgeType: true, title: true },
  });
  const existingByUser = new Map(existing.map((a) => [a.userId, a]));
  const ids = new Set<string>([...rankedUserIds.slice(0, 10), ...existing.map((a) => a.userId)]);
  ids.delete(skipUserId);

  for (const uid of ids) {
    const idx = rankedUserIds.indexOf(uid);
    const want = idx === -1 ? null : BADGE_BY_RANK(idx + 1);
    const prev = existingByUser.get(uid);
    if ((prev?.badgeType ?? null) === (want?.type ?? null)) continue; // already correct

    if (want) {
      await prisma.achievement.deleteMany({ where: { userId: uid, lessonId, badgeType: { not: want.type } } });
      await prisma.achievement.upsert({
        where: { userId_lessonId_badgeType: { userId: uid, lessonId, badgeType: want.type } },
        update: { title: want.title, courseId },
        create: { userId: uid, title: want.title, badgeType: want.type, lessonId, courseId },
      });
    } else {
      await prisma.achievement.deleteMany({ where: { userId: uid, lessonId } });
    }

    const prevStrength = prev ? (BADGE_STRENGTH[prev.badgeType] ?? 99) : 99;
    const newStrength = want ? BADGE_STRENGTH[want.type] : 99;
    if (prev && newStrength > prevStrength) {
      notifyBadgeLost({
        userId: uid,
        lessonId,
        oldBadge: prev.title,
        newBadge: want?.title || "None",
        newRank: idx === -1 ? 11 : idx + 1,
      }).catch(() => {});
    } else if (want && newStrength < prevStrength) {
      notifyAchievement({ userId: uid, title: want.title, badgeType: want.type, lessonId, courseId }).catch(() => {});
    }
  }
}

export interface LessonQuizEntry {
  userId: string;
  score: number;
  correctCount: number;
  totalTime: number;
  earliestSubmit: Date;
}

/**
 * Everyone who attempted this lesson's quiz, best first (no pass mark applied).
 *  - Each question counts from the student's FIRST answer to it; retries are practice.
 *  - The score is out of ALL questions in the lesson quiz.
 *  - Order: score, then correct answers, then total time (faster), then earliest.
 */
export async function rankLessonQuiz(lessonId: string): Promise<{ ranked: LessonQuizEntry[]; questionCount: number }> {
  const quizIds = (await prisma.quiz.findMany({ where: { lessonId }, select: { id: true } })).map((q) => q.id);
  const questionCount = quizIds.length;
  if (questionCount === 0) return { ranked: [], questionCount: 0 };

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: { in: quizIds } },
    select: { userId: true, quizId: true, correct: true, createdAt: true, timeTaken: true },
    orderBy: { createdAt: "asc" },
  });

  const seen = new Set<string>();
  const byUser = new Map<string, { answered: number; correct: number; totalTime: number; earliest: Date }>();
  for (const a of attempts) {
    const key = `${a.userId}:${a.quizId}`;
    if (seen.has(key)) continue; // only the first answer to each question counts
    seen.add(key);
    let u = byUser.get(a.userId);
    if (!u) { u = { answered: 0, correct: 0, totalTime: 0, earliest: a.createdAt }; byUser.set(a.userId, u); }
    u.answered++;
    if (a.correct) u.correct++;
    if (a.timeTaken) u.totalTime += a.timeTaken;
    if (a.createdAt < u.earliest) u.earliest = a.createdAt;
  }

  const ranked = [...byUser.entries()]
    .map(([userId, d]) => ({
      userId,
      score: Math.round((d.correct / Math.max(d.answered, questionCount)) * 100),
      correctCount: d.correct,
      totalTime: d.totalTime,
      earliestSubmit: d.earliest,
    }))
    .sort((a, b) =>
      b.score - a.score ||
      b.correctCount - a.correctCount ||
      a.totalTime - b.totalTime ||
      a.earliestSubmit.getTime() - b.earliestSubmit.getTime());
  return { ranked, questionCount };
}

/**
 * Recalculate lesson leaderboard and award coins if the user qualifies.
 * Safe to call multiple times — prevents duplicate coin awards.
 */
export async function recalculateAndAwardCoins(
  userId: string,
  lessonId: string,
  courseId: string
): Promise<LeaderboardResult> {
  try {
    const { ranked: everyone } = await rankLessonQuiz(lessonId);
    if (everyone.length === 0) return { rank: null, coinsAwarded: 0, badge: null };
    // Only students who score at least the pass mark can win a medal.
    const ranked = everyone.filter((e) => e.score >= QUIZ_PASS_PERCENT);

    // Find user's rank
    // ── KEEP EVERYONE ELSE'S BADGE CURRENT ──
    // When a new student takes first place, the student who held it moves down.
    // Fix their badge now (not only when they next open the quiz).
    await syncOtherBadges(userId, lessonId, courseId, ranked.map((e) => e.userId));

    const userIndex = ranked.findIndex((e) => e.userId === userId);
    if (userIndex === -1) {
      // Below the pass mark: no rank, no medal, no coins.
      await prisma.achievement.deleteMany({ where: { userId, lessonId } });
      return { rank: null, coinsAwarded: 0, badge: null };
    }

    const rank = userIndex + 1;

    // Determine badge based on current live rank
    let badgeType: string | null = null;
    let badgeTitle: string | null = null;

    if (rank === 1) {
      badgeType = "super-master"; badgeTitle = "Quiz Gold";
    } else if (rank === 2) {
      badgeType = "master"; badgeTitle = "Quiz Silver";
    } else if (rank >= 3 && rank <= 10) {
      badgeType = "pro"; badgeTitle = "Quiz Bronze";
    }

    // ── LIVE BADGE SYNC ──
    // Always update the achievement badge to match current rank.
    // If user was rank 1 before (Super Master) but now rank 3 (Pro), badge updates to Pro.

    // Fetch previous badge for this lesson to detect a downgrade/loss (#13)
    const prevAchievement = await prisma.achievement.findFirst({
      where: { userId, lessonId },
      select: { badgeType: true, title: true },
    });
    // Badge rank strength (lower number = stronger). Used to detect downgrade.
    const badgeStrength: Record<string, number> = { "super-master": 1, "master": 2, "pro": 3 };
    const prevStrength = prevAchievement ? (badgeStrength[prevAchievement.badgeType] ?? 99) : 99;
    const newStrength = badgeType ? (badgeStrength[badgeType] ?? 99) : 99;

    if (badgeType && badgeTitle) {
      // Delete any old achievement for this user+lesson (different badgeType)
      await prisma.achievement.deleteMany({
        where: { userId, lessonId, badgeType: { not: badgeType } },
      });
      // Upsert current badge (create if new, update title if same type)
      await prisma.achievement.upsert({
        where: { userId_lessonId_badgeType: { userId, lessonId, badgeType } },
        update: { title: badgeTitle, courseId },
        create: { userId, title: badgeTitle, badgeType, lessonId, courseId },
      });
    } else {
      // Rank > 10: remove any existing badge for this lesson
      await prisma.achievement.deleteMany({
        where: { userId, lessonId },
      });
    }

    // Notification: badge lost / rank dropped (#13) — non-blocking.
    // Only fire when the user previously had a badge AND it got weaker or removed.
    if (prevAchievement && newStrength > prevStrength) {
      notifyBadgeLost({
        userId,
        lessonId,
        oldBadge: prevAchievement.title,
        newBadge: badgeTitle || "None",
        newRank: rank,
      }).catch(() => {});
    }

    // Notification: achievement EARNED — fire whenever the badge is newly earned
    // OR UPGRADED (e.g. Pro → Super Master). This must NOT depend on the coin
    // early-return below: if the user already earned coins for this lesson at a
    // lower rank and later climbs to a stronger badge, they'd otherwise get no
    // notification. Idempotency key includes badgeType, so each distinct badge
    // notifies at most once (no duplicates for the same badge).
    if (badgeType && badgeTitle && newStrength < prevStrength) {
      notifyAchievement({ userId, title: badgeTitle, badgeType, lessonId, courseId }).catch(() => {});
    }

    // Determine coins based on rank (for first-time award only)
    let coins = 0;
    if (rank === 1) coins = 10;
    else if (rank === 2) coins = 7;
    else if (rank >= 3 && rank <= 10) coins = 5;

    if (coins === 0) return { rank, coinsAwarded: 0, badge: badgeType };

    // Check if already rewarded for this lesson (prevent duplicate coin awards)
    const existingTransaction = await prisma.coinTransaction.findFirst({
      where: { userId, lessonId, type: "EARNED" },
    });

    if (existingTransaction) {
      // Already got coins — return current rank + badge (no new coins)
      return { rank, coinsAwarded: 0, badge: badgeType };
    }

    // Award coins (first time only — atomic transaction)
    await prisma.$transaction([
      prisma.userCoins.upsert({
        where: { userId },
        update: { totalCoins: { increment: coins } },
        create: { userId, totalCoins: coins },
      }),
      prisma.coinTransaction.create({
        data: {
          userId,
          type: "EARNED",
          coins,
          reason: `Quiz Rank #${rank} - Lesson reward`,
          lessonId,
          courseId,
        },
      }),
    ]);

    // NOTE: the achievement-earned notification is fired earlier (on badge
    // create/upgrade), independent of this coin-award path — so a badge upgrade
    // when coins were already given still notifies. No duplicate here.

    return { rank, coinsAwarded: coins, badge: badgeType };
  } catch {
    return { rank: null, coinsAwarded: 0, badge: null };
  }
}
