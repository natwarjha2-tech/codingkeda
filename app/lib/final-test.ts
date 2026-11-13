/**
 * Final course test — shared logic (routes + generator script).
 *
 * A course's final test is a fixed set of up to 50 questions drawn from the
 * course's EXISTING lesson quizzes, spread evenly across every lesson (round
 * robin), then shuffled. Each attempt re-shuffles the order. Answers are never
 * sent to the client; grading happens on the server.
 */
import { randomBytes, randomInt } from "crypto";
import type { PrismaClient } from "@prisma/client";

export const FINAL_TEST_SIZE = 50;
export const FINAL_TEST_PASS_PERCENT = 60;
export const FINAL_TEST_TIME_LIMIT_MIN = 60;
/** After a FAILED attempt the student can retry after this many hours. */
export const FINAL_TEST_COOLDOWN_HOURS = 24;
/** Extra seconds accepted after the time limit (network delay / auto-submit). */
export const FINAL_TEST_GRACE_SEC = 120;

/** Fisher–Yates shuffle with a cryptographic RNG (returns a new array). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick up to `target` quiz ids so every lesson is represented as evenly as
 * possible: shuffle each lesson's quizzes, then take one per lesson per round
 * (lessons visited in random order) until the target is reached.
 */
export function pickBalancedQuizIds(
  lessons: { lessonId: string; quizIds: string[] }[],
  target = FINAL_TEST_SIZE
): string[] {
  const pools = shuffle(lessons.filter((l) => l.quizIds.length > 0)).map((l) => shuffle(l.quizIds));
  const picked: string[] = [];
  let round = 0;
  while (picked.length < target) {
    let tookAny = false;
    for (const pool of pools) {
      if (picked.length >= target) break;
      if (round < pool.length) {
        picked.push(pool[round]);
        tookAny = true;
      }
    }
    if (!tookAny) break; // every lesson exhausted
    round++;
  }
  return shuffle(picked);
}

export interface BuildResult {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  lessonsWithQuizzes: number;
  availableQuizzes: number;
  picked: number;
  warning?: string;
}

/** Create or regenerate the final test for one course. */
export async function buildFinalTestForCourse(
  db: PrismaClient,
  courseId: string,
  target = FINAL_TEST_SIZE
): Promise<BuildResult> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      modules: {
        orderBy: { order: "asc" },
        select: {
          lessons: {
            orderBy: { order: "asc" },
            select: { id: true, quizzes: { select: { id: true } } },
          },
        },
      },
    },
  });
  if (!course) throw new Error(`Course not found: ${courseId}`);

  const lessons = course.modules.flatMap((m) => m.lessons);
  const pools = lessons.map((l) => ({ lessonId: l.id, quizIds: l.quizzes.map((q) => q.id) }));
  const available = pools.reduce((s, p) => s + p.quizIds.length, 0);
  const quizIds = pickBalancedQuizIds(pools, target);
  if (quizIds.length === 0) throw new Error(`Course "${course.title}" has no lesson quizzes yet.`);

  await db.finalTest.upsert({
    where: { courseId },
    create: { courseId, quizIds, passPercent: FINAL_TEST_PASS_PERCENT, timeLimitMin: FINAL_TEST_TIME_LIMIT_MIN },
    update: { quizIds },
  });

  return {
    courseId,
    courseTitle: course.title,
    totalLessons: lessons.length,
    lessonsWithQuizzes: pools.filter((p) => p.quizIds.length > 0).length,
    availableQuizzes: available,
    picked: quizIds.length,
    warning: quizIds.length < target
      ? `Only ${quizIds.length} quizzes exist in this course — the test uses all of them (target ${target}).`
      : undefined,
  };
}

/** Lessons completed vs total for one user in one course. */
export async function getCourseCompletion(db: PrismaClient, userId: string, courseId: string) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const ids = lessons.map((l) => l.id);
  const completed = ids.length
    ? await db.progress.count({ where: { userId, completed: true, lessonId: { in: ids } } })
    : 0;
  return { totalLessons: ids.length, completedLessons: completed, allCompleted: ids.length > 0 && completed >= ids.length };
}

/** Certificate id printed on the PDF, e.g. CK-2026-7F3A9C. */
export function generateCertificateCode(): string {
  // 4 random bytes → 8 hex chars (~4 billion values): not guessable for the
  // public verify endpoint.
  return `CK-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Normalise a JSON column to a string array. */
export function asIdArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Normalise a JSON column to an answers map. */
export function asAnswers(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const n = Number(val);
      if (Number.isInteger(n) && n >= 0 && n < 10) out[k] = n;
    }
  }
  return out;
}

/** Names allowed on a certificate: Latin letters, spaces, . ' - (2–60 chars). */
export function validateCertificateName(raw: unknown): string | null {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(name)) return null;
  return name;
}
