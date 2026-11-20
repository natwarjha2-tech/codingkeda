/**
 * XP (learning points), worked out on the server from what the student has
 * really done, so it is the same on phone, desktop and website and can't be lost.
 * Nothing new is stored: XP is counted from existing records every time.
 *
 *   Watch a lesson video to the end  → +10 XP   (lesson marked complete)
 *   Answer a quiz question correctly → +5 XP    (each question once)
 *   Finish a lesson's quiz           → +20 XP   (all its questions answered)
 *   Solve a coding exercise          → +30 XP   (all tests passed, once)
 *   Solve the weekly challenge       → +50 XP   (once a week)
 *
 *   Every 100 XP = 1 level.
 */
import { prisma } from "@/app/lib/prisma";

export const XP_REWARDS = {
  video: 10,
  quizCorrect: 5,
  quizFinished: 20,
  exercise: 30,
  weekly: 50,
} as const;

export const XP_PER_LEVEL = 100;
export const LEVEL_TITLES = ["Starter", "Explorer", "Builder", "Coder", "Pro Coder", "Champion", "Master", "Legend"];

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(Math.max(level, 1), LEVEL_TITLES.length) - 1];
}

export function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const floor = (level - 1) * XP_PER_LEVEL;
  const ceil = level * XP_PER_LEVEL;
  return {
    level,
    title: levelTitle(level),
    xp,
    floor,
    ceil,
    next: { level: level + 1, title: levelTitle(level + 1), min: ceil },
    toNext: ceil - xp,
    progressPct: Math.round(((xp - floor) / XP_PER_LEVEL) * 100),
  };
}

export async function getStudentXp(userId: string) {
  const [videos, correct, attempted, exercises, weekly] = await Promise.all([
    prisma.progress.count({ where: { userId, completed: true } }),
    prisma.quizAttempt.findMany({ where: { userId, correct: true }, distinct: ["quizId"], select: { quizId: true } }),
    prisma.quizAttempt.findMany({ where: { userId }, distinct: ["quizId"], select: { quiz: { select: { lessonId: true } } } }),
    prisma.exerciseSubmission.findMany({ where: { userId, passed: true }, distinct: ["exerciseId"], select: { exerciseId: true } }),
    prisma.coinTransaction.count({ where: { userId, type: "EARNED", reason: { startsWith: "WeeklyCode:" } } }),
  ]);

  // A lesson's quiz is "finished" when every question in it has been answered.
  const answeredPerLesson = new Map<string, number>();
  for (const a of attempted) {
    const lid = a.quiz?.lessonId;
    if (lid) answeredPerLesson.set(lid, (answeredPerLesson.get(lid) ?? 0) + 1);
  }
  let quizzesFinished = 0;
  if (answeredPerLesson.size > 0) {
    const totals = await prisma.quiz.groupBy({
      by: ["lessonId"],
      where: { lessonId: { in: [...answeredPerLesson.keys()] } },
      _count: { _all: true },
    });
    for (const t of totals) {
      if ((answeredPerLesson.get(t.lessonId) ?? 0) >= t._count._all) quizzesFinished++;
    }
  }

  const breakdown = {
    videos: { count: videos, xp: videos * XP_REWARDS.video },
    quizCorrect: { count: correct.length, xp: correct.length * XP_REWARDS.quizCorrect },
    quizzesFinished: { count: quizzesFinished, xp: quizzesFinished * XP_REWARDS.quizFinished },
    exercises: { count: exercises.length, xp: exercises.length * XP_REWARDS.exercise },
    weekly: { count: weekly, xp: weekly * XP_REWARDS.weekly },
  };
  const xp = Object.values(breakdown).reduce((s, b) => s + b.xp, 0);
  return { ...levelInfo(xp), breakdown, rewards: XP_REWARDS, xpPerLevel: XP_PER_LEVEL };
}
