/**
 * Weekly parent report on WhatsApp — business logic for the admin routes.
 *
 * Who gets a message: students whose parent consented (ParentReportConsent),
 * with a verified parent number, and not already sent that week. A student with
 * no activity still gets a short, polite note so the parent knows. Sending is done in small batches and stops at the daily limit
 * Meta allows for the account (WHATSAPP_DAILY_LIMIT, default 250/24 h).
 *
 * DRY RUN (default): nothing is sent and NOTHING IS WRITTEN — the plan is only
 * computed and returned.
 */
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { Prisma } from "@prisma/client";
import {
  isDryRun, isTestMode, maskNumber, normalizeWhatsAppNumber, sendWhatsAppTemplate, sendWhatsAppText,
  testAllowlist, testAsText, waSettings,
} from "@/app/lib/whatsapp";
import {
  buildTemplateParams, chunk, emptyStats, hasActivity, istDayLabel, istYmd, renderPreviewText, reportWeekFor, weekdayName,
  type ReportWeek, type WeekStats,
} from "@/app/lib/weekly-report";

export interface PlanItem {
  userId: string;
  studentName: string;
  parentName: string | null;
  to: string | null; // normalized, digits only — NEVER returned to the browser
  stats: WeekStats;
  params: string[];
  state: "ready" | "no_number" | "not_verified" | "inactive" | "already_sent" | "failed";
}

export interface Plan {
  week: ReportWeek;
  consented: number;
  items: PlanItem[];
}

const DB_CHUNK = 1500;

/** Everything needed to know who would get what this week. Read-only. */
export async function buildPlan(now: Date = new Date(), opts: { retryFailed?: boolean } = {}): Promise<Plan> {
  const week = reportWeekFor(now);

  const testMode = isTestMode();
  let ids: string[];
  if (testMode) {
    // TEST MODE: only students whose parent number is on the test allow-list
    // (numbers Meta already verified in its dashboard). Everyone else is ignored.
    const last10s = testAllowlist().map((n) => n.slice(-10));
    const rows = last10s.length
      ? await prisma.$queryRaw<{ userId: string }[]>`
          SELECT "userId" FROM "Student"
          WHERE right(regexp_replace(coalesce("parentContact", ''), '\D', '', 'g'), 10) IN (${Prisma.join(last10s)})`
      : [];
    ids = rows.map((r) => r.userId);
  } else {
    const consented = await prisma.parentReportConsent.findMany({ where: { consent: true }, select: { userId: true } });
    ids = consented.map((c) => c.userId);
  }

  const students: { userId: string; name: string | null; studentName: string | null; parentName: string | null; parentContact: string | null }[] = [];
  // Verified parent numbers: only a code that was REALLY delivered on WhatsApp counts.
  const verified = new Map<string, string>(); // userId -> verified normalized number
  const stats = new Map<string, WeekStats>();
  const getStats = (id: string) => {
    let s = stats.get(id);
    if (!s) { s = emptyStats(); stats.set(id, s); }
    return s;
  };

  for (const part of chunk(ids, DB_CHUNK)) {
    const inWeek = { gte: week.startUtc, lt: week.endUtc };
    const [st, ver, daily, lessonRows, quizRows, exRows, coinRows, badgeRows, totalRows] = await Promise.all([
      prisma.student.findMany({
        where: { userId: { in: part } },
        select: { userId: true, name: true, studentName: true, parentName: true, parentContact: true },
      }),
      prisma.parentPhoneVerification.findMany({
        where: { userId: { in: part }, live: true, verifiedPhone: { not: null } },
        select: { userId: true, verifiedPhone: true },
      }),
      // Same table the student's calendar and "This Week" card read.
      prisma.dailyActivity.findMany({
        where: { userId: { in: part }, date: { in: week.dates } },
        select: { userId: true, date: true, minutes: true },
        orderBy: { date: "asc" },
      }),
      prisma.progress.findMany({
        where: { userId: { in: part }, completed: true, updatedAt: inWeek },
        select: { userId: true, lessonId: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
      }),
      prisma.quizAttempt.findMany({
        where: { userId: { in: part }, createdAt: inWeek },
        select: { userId: true, lessonId: true, correct: true, createdAt: true, quiz: { select: { lessonId: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.exerciseSubmission.findMany({
        where: { userId: { in: part }, passed: true, createdAt: inWeek },
        select: { userId: true, exerciseId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.coinTransaction.groupBy({
        by: ["userId"],
        where: { userId: { in: part }, type: "EARNED", createdAt: inWeek },
        _sum: { coins: true },
      }),
      prisma.achievement.findMany({
        where: { userId: { in: part }, createdAt: inWeek },
        select: { userId: true, title: true, lessonId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userCoins.findMany({
        where: { userId: { in: part } },
        select: { userId: true, totalCoins: true },
      }),
    ]);

    // Titles for the lessons and exercises that appear in this chunk.
    const lessonIds = new Set<string>();
    const exerciseIds = new Set<string>();
    for (const r of lessonRows) lessonIds.add(r.lessonId);
    for (const r of quizRows) { const id = r.lessonId ?? r.quiz?.lessonId; if (id) lessonIds.add(id); }
    for (const r of badgeRows) lessonIds.add(r.lessonId);
    for (const r of exRows) exerciseIds.add(r.exerciseId);
    const [lessonTitleRows, exerciseTitleRows] = await Promise.all([
      lessonIds.size
        ? prisma.lesson.findMany({ where: { id: { in: [...lessonIds] } }, select: { id: true, title: true } })
        : Promise.resolve([] as { id: string; title: string }[]),
      exerciseIds.size
        ? prisma.exercise.findMany({ where: { id: { in: [...exerciseIds] } }, select: { id: true, title: true } })
        : Promise.resolve([] as { id: string; title: string }[]),
    ]);
    const lessonTitle = new Map(lessonTitleRows.map((l) => [l.id, l.title]));
    const exerciseTitle = new Map(exerciseTitleRows.map((e) => [e.id, e.title]));

    students.push(...st);
    for (const v of ver) if (v.verifiedPhone) verified.set(v.userId, v.verifiedPhone);

    for (const d of daily) {
      const s = getStats(d.userId);
      s.minutes += d.minutes;
      if (d.minutes > 0) {
        s.activeDays += 1;
        s.activeDayNames.push(weekdayName(d.date));
      }
    }
    for (const l of lessonRows) {
      getStats(l.userId).lessons.push({ title: lessonTitle.get(l.lessonId) ?? "Lesson", date: istDayLabel(l.updatedAt) });
    }
    // One quiz entry per student + lesson + day: score = right answers / answers given.
    const quizGroups = new Map<string, { userId: string; title: string; date: string; correct: number; total: number }>();
    for (const q of quizRows) {
      const lid = q.lessonId ?? q.quiz?.lessonId ?? "";
      const key = `${q.userId}|${lid}|${istYmd(q.createdAt)}`;
      let g = quizGroups.get(key);
      if (!g) {
        g = { userId: q.userId, title: lessonTitle.get(lid) ?? "Quiz", date: istDayLabel(q.createdAt), correct: 0, total: 0 };
        quizGroups.set(key, g);
      }
      g.total += 1;
      if (q.correct) g.correct += 1;
    }
    for (const g of quizGroups.values()) {
      getStats(g.userId).quizzes.push({ title: g.title, date: g.date, correct: g.correct, total: g.total });
    }
    // Each exercise counts once, on the day it was first passed this week.
    const seenExercise = new Set<string>();
    for (const e of exRows) {
      const key = `${e.userId}|${e.exerciseId}`;
      if (seenExercise.has(key)) continue;
      seenExercise.add(key);
      getStats(e.userId).exercises.push({ title: exerciseTitle.get(e.exerciseId) ?? "Exercise", date: istDayLabel(e.createdAt) });
    }
    for (const b of badgeRows) {
      getStats(b.userId).badges.push({ title: `${b.title} (${lessonTitle.get(b.lessonId) ?? "Lesson"})`, date: istDayLabel(b.createdAt) });
    }
    for (const c of coinRows) getStats(c.userId).coinsWeek = c._sum.coins ?? 0;
    for (const t of totalRows) getStats(t.userId).coinsTotal = t.totalCoins;
  }

  const logs = await prisma.weeklyReportLog.findMany({
    where: { weekStart: week.start },
    select: { userId: true, status: true },
  });
  // Test mode may re-send the same week as often as you like.
  const sentSet = new Set(testMode ? [] : logs.filter((l) => l.status === "sent").map((l) => l.userId));
  // A failed send is set aside (so one run never loops on it); "Retry failed" brings it back.
  const failedSet = new Set(logs.filter((l) => l.status === "failed").map((l) => l.userId));

  const items: PlanItem[] = students.map((s) => {
    const st = stats.get(s.userId) ?? emptyStats();
    const studentName = (s.studentName || s.name || "Student").trim();
    const to = normalizeWhatsAppNumber(s.parentContact);
    let state: PlanItem["state"] = "ready";
    if (sentSet.has(s.userId)) state = "already_sent";
    else if (!to) state = "no_number";
    // The number on the profile must be the one the parent verified (editing it un-verifies).
    else if (!testMode && verified.get(s.userId) !== to) state = "not_verified";
    // A student with no activity still gets a (polite) report, so the parent knows.
    else if (!testMode && failedSet.has(s.userId) && !opts.retryFailed) state = "failed";
    return {
      userId: s.userId, studentName, parentName: s.parentName?.trim() || null, to, stats: st,
      params: buildTemplateParams({ parentName: s.parentName, studentName, week, stats: st }),
      state,
    };
  });

  return { week, consented: ids.length, items };
}

export function summarize(plan: Plan) {
  const count = (state: PlanItem["state"]) => plan.items.filter((i) => i.state === state).length;
  return {
    consented: plan.consented,
    ready: count("ready"),
    noNumber: count("no_number"),
    notVerified: count("not_verified"),
    // Informational: ready to send, but with no activity (the parent gets a gentle reminder).
    inactive: plan.items.filter((i) => i.state === "ready" && !hasActivity(i.stats)).length,
    alreadySent: count("already_sent"),
    failed: count("failed"),
  };
}

/** Admin preview (no phone numbers leave the server in full). */
export async function previewWeeklyReports(now: Date = new Date()) {
  const plan = await buildPlan(now);
  const samples = plan.items
    .filter((i) => i.state === "ready")
    .slice(0, 3)
    .map((i) => ({ studentName: i.studentName, to: i.to ? maskNumber(i.to) : null, params: i.params, text: renderPreviewText(i.params) }));
  const recentFailures = await prisma.weeklyReportLog.findMany({
    where: { weekStart: plan.week.start, status: "failed" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { userId: true, error: true, toLast4: true, updatedAt: true },
  });
  return {
    week: { start: plan.week.start, label: plan.week.label },
    autoEnabled: await getAutoEnabled(),
    settings: waSettings(),
    totals: summarize(plan),
    samples,
    recentFailures,
  };
}

async function sendOne(item: PlanItem, weekStart: string): Promise<{ ok: boolean; error?: string }> {
  // Test mode can send the real report text as a plain message (no template needed).
  const r = testAsText()
    ? await sendWhatsAppText(item.to as string, renderPreviewText(item.params))
    : await sendWhatsAppTemplate(item.to as string, item.params);
  const last4 = (item.to as string).slice(-4);
  await prisma.weeklyReportLog.upsert({
    where: { userId_weekStart: { userId: item.userId, weekStart } },
    create: {
      userId: item.userId, weekStart, status: r.ok ? "sent" : "failed",
      error: r.ok ? null : r.error.slice(0, 300), waMessageId: r.ok ? r.id : null, toLast4: last4,
    },
    update: { status: r.ok ? "sent" : "failed", error: r.ok ? null : r.error.slice(0, 300), waMessageId: r.ok ? r.id : null, toLast4: last4 },
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/**
 * Send up to `limit` reports (one batch). The admin page calls this repeatedly
 * until `remaining` is 0 or the daily limit is reached.
 */
export async function sendWeeklyReportBatch(limit: number, opts: { retryFailed?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const settings = waSettings();
  const plan = await buildPlan(now, { retryFailed: opts.retryFailed });
  const totals = summarize(plan);
  const ready = plan.items.filter((i) => i.state === "ready");

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sentLast24h = await prisma.weeklyReportLog.count({ where: { status: "sent", createdAt: { gte: since } } });
  const capLeft = Math.max(0, settings.dailyLimit - sentLast24h);
  const take = Math.max(0, Math.min(limit, capLeft, ready.length));

  if (isDryRun() || !settings.configured) {
    return {
      dryRun: true, configured: settings.configured, week: plan.week.label, totals,
      wouldSend: take, remaining: Math.max(0, ready.length - take), sent: 0, failed: 0, capReached: capLeft === 0 && ready.length > 0, failures: [] as { studentName: string; error: string }[],
    };
  }

  const batch = ready.slice(0, take);
  let sent = 0;
  const failures: { studentName: string; error: string }[] = [];
  // Small concurrency keeps us well under Meta's throughput limits.
  for (const group of chunk(batch, 5)) {
    const results = await Promise.all(group.map((it) => sendOne(it, plan.week.start)));
    results.forEach((r, i) => {
      if (r.ok) sent += 1;
      else failures.push({ studentName: group[i].studentName, error: r.error || "failed" });
    });
  }
  logger.info("weekly-report", "batch_done", { week: plan.week.start, attempted: batch.length, sent, failed: failures.length });

  // Everything in this batch (sent or failed) leaves the "ready" list, so the page can't loop on a failure.
  const remaining = Math.max(0, ready.length - batch.length);
  return {
    dryRun: false, configured: true, week: plan.week.label, totals,
    wouldSend: 0, remaining, sent, failed: failures.length, capReached: capLeft - batch.length <= 0 && remaining > 0, failures,
  };
}

/** One message to a specific number — to check the setup works (super-admin only). */
export async function sendTestMessage(rawNumber: string, studentName = "Aarav") {
  const to = normalizeWhatsAppNumber(rawNumber);
  if (!to) return { ok: false as const, error: "That doesn't look like a valid phone number." };
  const week = reportWeekFor();
  const params = buildTemplateParams({
    parentName: "Parent", studentName, week,
    stats: {
      minutes: 215, activeDays: 4, activeDayNames: ["Mon", "Tue", "Thu", "Sat"],
      lessons: [{ title: "Variables", date: "10 Nov" }, { title: "Loops", date: "12 Nov" }],
      exercises: [{ title: "Print a pattern", date: "12 Nov" }],
      quizzes: [{ title: "Loops", date: "12 Nov", correct: 8, total: 10 }],
      badges: [{ title: "Master (Loops)", date: "12 Nov" }],
      coinsWeek: 7, coinsTotal: 140,
    },
  });
  if (isDryRun() || !waSettings().configured) {
    return { ok: true as const, dryRun: true as const, to: maskNumber(to), text: renderPreviewText(params) };
  }
  const r = testAsText()
    ? await sendWhatsAppText(to, renderPreviewText(params))
    : await sendWhatsAppTemplate(to, params);
  return r.ok
    ? { ok: true as const, dryRun: false as const, to: maskNumber(to), text: renderPreviewText(params) }
    : { ok: false as const, error: r.error };
}

// ── Consent ─────────────────────────────────────────────────────────────────
export async function getParentReportConsent(userId: string): Promise<boolean> {
  try {
    const c = await prisma.parentReportConsent.findUnique({ where: { userId }, select: { consent: true } });
    return !!c?.consent;
  } catch {
    return false; // table not migrated yet → treated as "no consent", never breaks the profile
  }
}

export async function setParentReportConsent(userId: string, consent: boolean, source = "app") {
  await prisma.parentReportConsent.upsert({
    where: { userId },
    create: { userId, consent, source },
    update: { consent, source },
  });
}

/** A parent replied STOP on WhatsApp → withdraw consent for every student with that number. */
export async function optOutByNumber(waNumber: string): Promise<number> {
  const last10 = waNumber.replace(/\D/g, "").slice(-10);
  if (last10.length < 10) return 0;
  const rows = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT "userId" FROM "Student"
    WHERE right(regexp_replace(coalesce("parentContact", ''), '\D', '', 'g'), 10) = ${last10}`;
  for (const r of rows) await setParentReportConsent(r.userId, false, "whatsapp_stop");
  return rows.length;
}

// ── Automatic weekly run ────────────────────────────────────────────────────
// A cron job on the server calls POST /api/cron/weekly-reports (see that route).
// This on/off switch lives in the existing SiteConfig table (no new table).
const AUTO_KEY = "weekly_report_auto";

export async function getAutoEnabled(): Promise<boolean> {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: AUTO_KEY } });
    return row?.value === "on";
  } catch {
    return false;
  }
}

export async function setAutoEnabled(on: boolean): Promise<void> {
  await prisma.siteConfig.upsert({
    where: { key: AUTO_KEY },
    create: { key: AUTO_KEY, value: on ? "on" : "off" },
    update: { value: on ? "on" : "off" },
  });
}

let autoRunning = false; // one automatic run at a time (the app runs as a single PM2 process)

export type AutoRunResult =
  | { skipped: "auto_off" | "already_running" }
  | { skipped: "dry_run"; wouldSend: number; week: string }
  | { skipped?: undefined; week: string; sent: number; failed: number; remaining: number; capReached: boolean };

/**
 * Send every ready report (verified + consenting parents), batch by batch,
 * stopping at Meta's daily limit. Safe to call repeatedly: a parent who already
 * got this week's report is skipped, and a run that hit the limit simply
 * continues on the next call.
 */
export async function runAutomaticWeeklyReports(now: Date = new Date()): Promise<AutoRunResult> {
  if (autoRunning) return { skipped: "already_running" };
  if (!(await getAutoEnabled())) return { skipped: "auto_off" };
  autoRunning = true;
  try {
    let sent = 0;
    let failed = 0;
    let last: Awaited<ReturnType<typeof sendWeeklyReportBatch>> | null = null;
    for (let round = 0; round < 400; round++) {
      last = await sendWeeklyReportBatch(50, { now });
      if (last.dryRun) return { skipped: "dry_run", wouldSend: last.wouldSend + last.remaining, week: last.week };
      sent += last.sent;
      failed += last.failed;
      if (last.capReached || last.remaining <= 0 || last.sent + last.failed === 0) break;
    }
    logger.info("weekly-report", "auto_run_done", { week: last?.week, sent, failed, remaining: last?.remaining ?? 0 });
    return { week: last?.week ?? "", sent, failed, remaining: last?.remaining ?? 0, capReached: !!last?.capReached };
  } finally {
    autoRunning = false;
  }
}
