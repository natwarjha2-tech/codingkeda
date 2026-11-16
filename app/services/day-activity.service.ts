/**
 * Daily activity loader — the one place that knows what a student did on each day.
 *
 * Used by:
 *  - GET /api/student/activity  (the calendar day popup in the mobile and desktop apps)
 *  - the weekly parent report   (adds up exactly these days)
 *
 * Days are IST calendar days. Time spent comes from DailyActivity (the same table
 * the calendar colours come from); everything else is read from the records with
 * their own timestamps. Read-only.
 */
import { prisma } from "@/app/lib/prisma";
import { emptyDay, type DayActivity } from "@/app/lib/day-activity";
import { istRangeUtc, istYmd } from "@/app/lib/ist";

/** userId → date → activity. Every requested date is present for every user. */
export async function loadDayActivity(userIds: string[], dates: string[]): Promise<Map<string, Map<string, DayActivity>>> {
  const result = new Map<string, Map<string, DayActivity>>();
  if (userIds.length === 0 || dates.length === 0) return result;

  const sorted = [...dates].sort();
  const { startUtc, endUtc } = istRangeUtc(sorted[0], sorted[sorted.length - 1]);
  const inRange = { gte: startUtc, lt: endUtc };
  const dateSet = new Set(sorted);

  const dayOf = (userId: string, date: string): DayActivity | null => {
    if (!dateSet.has(date)) return null;
    let byDate = result.get(userId);
    if (!byDate) {
      byDate = new Map(sorted.map((d) => [d, emptyDay(d)]));
      result.set(userId, byDate);
    }
    return byDate.get(date) ?? null;
  };
  for (const id of userIds) dayOf(id, sorted[0]); // make sure every user has an entry

  const [daily, progress, attempts, submissions, coins, badges] = await Promise.all([
    prisma.dailyActivity.findMany({
      where: { userId: { in: userIds }, date: { in: sorted } },
      select: { userId: true, date: true, minutes: true, sessions: true },
    }),
    prisma.progress.findMany({
      where: {
        userId: { in: userIds },
        completed: true,
        // Lessons completed before completedAt existed fall back to their last update time.
        OR: [{ completedAt: inRange }, { completedAt: null, updatedAt: inRange }],
      },
      select: { userId: true, lessonId: true, completedAt: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.quizAttempt.findMany({
      where: { userId: { in: userIds }, createdAt: inRange },
      select: { userId: true, lessonId: true, correct: true, createdAt: true, quiz: { select: { lessonId: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.exerciseSubmission.findMany({
      where: { userId: { in: userIds }, createdAt: inRange },
      select: { userId: true, exerciseId: true, passed: true, language: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.coinTransaction.findMany({
      where: { userId: { in: userIds }, createdAt: inRange },
      select: { userId: true, type: true, coins: true, reason: true, lessonId: true, courseId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.achievement.findMany({
      where: { userId: { in: userIds }, createdAt: inRange },
      select: { userId: true, title: true, lessonId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Names for every lesson / exercise that appears.
  const lessonIds = new Set<string>();
  const exerciseIds = new Set<string>();
  for (const r of progress) lessonIds.add(r.lessonId);
  for (const r of attempts) { const id = r.lessonId ?? r.quiz?.lessonId; if (id) lessonIds.add(id); }
  for (const r of badges) lessonIds.add(r.lessonId);
  for (const r of submissions) exerciseIds.add(r.exerciseId);
  const courseIds = new Set<string>();
  for (const r of coins) {
    if (r.lessonId) lessonIds.add(r.lessonId);
    else if (r.courseId) courseIds.add(r.courseId);
  }

  const [lessonRows, exerciseRows, courseRows] = await Promise.all([
    lessonIds.size
      ? prisma.lesson.findMany({
          where: { id: { in: [...lessonIds] } },
          select: { id: true, title: true, module: { select: { title: true, course: { select: { title: true } } } } },
        })
      : Promise.resolve([]),
    exerciseIds.size
      ? prisma.exercise.findMany({
          where: { id: { in: [...exerciseIds] } },
          select: {
            id: true,
            title: true,
            lesson: { select: { title: true, module: { select: { title: true, course: { select: { title: true } } } } } },
          },
        })
      : Promise.resolve([]),
    courseIds.size
      ? prisma.course.findMany({ where: { id: { in: [...courseIds] } }, select: { id: true, title: true } })
      : Promise.resolve([]),
  ]);
  const courseTitle = new Map(courseRows.map((c) => [c.id, c.title]));
  const lessonInfo = new Map(lessonRows.map((l) => [l.id, l]));
  const exerciseInfo = new Map(exerciseRows.map((e) => [e.id, e]));

  for (const d of daily) {
    const day = dayOf(d.userId, d.date);
    if (day) { day.minutes += d.minutes; day.sessions += d.sessions; }
  }

  for (const p of progress) {
    const at = p.completedAt ?? p.updatedAt;
    const day = dayOf(p.userId, istYmd(at));
    if (!day) continue;
    const l = lessonInfo.get(p.lessonId);
    day.lessons.push({
      title: l?.title ?? "Lesson",
      module: l?.module?.title ?? null,
      course: l?.module?.course?.title ?? null,
      at: at.toISOString(),
    });
  }

  // Quizzes: one entry per student + lesson + day (score = right answers / answers given).
  const quizGroups = new Map<string, { day: DayActivity; lessonId: string; correct: number; total: number; at: Date }>();
  for (const q of attempts) {
    const lid = q.lessonId ?? q.quiz?.lessonId ?? "";
    const date = istYmd(q.createdAt);
    const day = dayOf(q.userId, date);
    if (!day) continue;
    const key = `${q.userId}|${lid}|${date}`;
    let g = quizGroups.get(key);
    if (!g) { g = { day, lessonId: lid, correct: 0, total: 0, at: q.createdAt }; quizGroups.set(key, g); }
    g.total += 1;
    if (q.correct) g.correct += 1;
  }
  for (const g of quizGroups.values()) {
    const l = lessonInfo.get(g.lessonId);
    g.day.quizzes.push({
      lesson: l?.title ?? "Quiz",
      module: l?.module?.title ?? null,
      course: l?.module?.course?.title ?? null,
      correct: g.correct,
      total: g.total,
      at: g.at.toISOString(),
    });
  }

  // Exercises: one entry per student + exercise + day; passed if any attempt passed.
  const exGroups = new Map<string, { day: DayActivity; exerciseId: string; passed: boolean; attempts: number; language: string | null; at: Date }>();
  for (const s of submissions) {
    const date = istYmd(s.createdAt);
    const day = dayOf(s.userId, date);
    if (!day) continue;
    const key = `${s.userId}|${s.exerciseId}|${date}`;
    let g = exGroups.get(key);
    if (!g) { g = { day, exerciseId: s.exerciseId, passed: false, attempts: 0, language: s.language, at: s.createdAt }; exGroups.set(key, g); }
    g.attempts += 1;
    if (s.passed && !g.passed) { g.passed = true; g.at = s.createdAt; }
    if (s.language) g.language = s.language;
  }
  for (const g of exGroups.values()) {
    const e = exerciseInfo.get(g.exerciseId);
    g.day.exercises.push({
      title: e?.title ?? "Exercise",
      lesson: e?.lesson?.title ?? null,
      module: e?.lesson?.module?.title ?? null,
      course: e?.lesson?.module?.course?.title ?? null,
      language: g.language,
      passed: g.passed,
      attempts: g.attempts,
      at: g.at.toISOString(),
    });
  }

  for (const c of coins) {
    const day = dayOf(c.userId, istYmd(c.createdAt));
    if (!day) continue;
    const l = c.lessonId ? lessonInfo.get(c.lessonId) : undefined;
    day.coins.push({
      type: c.type,
      coins: c.coins,
      reason: c.reason,
      lesson: l?.title ?? null,
      module: l?.module?.title ?? null,
      course: l?.module?.course?.title ?? (c.courseId ? courseTitle.get(c.courseId) ?? null : null),
      at: c.createdAt.toISOString(),
    });
  }
  for (const b of badges) {
    const day = dayOf(b.userId, istYmd(b.createdAt));
    if (!day) continue;
    const l = lessonInfo.get(b.lessonId);
    day.badges.push({
      title: b.title,
      lesson: l?.title ?? "Lesson",
      module: l?.module?.title ?? null,
      course: l?.module?.course?.title ?? null,
      at: b.createdAt.toISOString(),
    });
  }

  return result;
}

/** One student's days, oldest first. */
export async function getStudentDays(userId: string, dates: string[]): Promise<DayActivity[]> {
  const map = await loadDayActivity([userId], dates);
  const byDate = map.get(userId);
  return [...dates].sort().map((d) => byDate?.get(d) ?? emptyDay(d));
}
