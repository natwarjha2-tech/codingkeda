/**
 * Weekly parent report — pure helpers (no database, easy to test).
 *
 * The WhatsApp template ({{1}}…{{10}}) is fixed once Meta approves it. Template
 * name: weekly_learning_report (category Utility). Body (line breaks are allowed
 * in the template text, NOT inside a variable value):
 *
 *   Hello {{1}}, here is the weekly learning report from CodingKida for {{2}} ({{3}}).
 *
 *   Learning time: {{4}}.
 *   Active days: {{5}}.
 *   Lessons completed: {{6}}.
 *   Coding exercises completed: {{7}}.
 *   Quizzes: {{8}}.
 *   Rewards: {{9}}.
 *
 *   {{10}}
 *
 *   You can see the full report in the CodingKida app. Thank you for supporting your child's learning.
 *
 * Every number and date here comes from the same records the student sees in the
 * app (daily activity calendar, completed lessons, quiz answers, coin rewards,
 * badges), for the same Monday–Sunday week.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReportWeek {
  /** Monday, "YYYY-MM-DD" (IST) — also the idempotency key for the send log. */
  start: string;
  /** The 7 calendar days Mon..Sun as "YYYY-MM-DD" (matches DailyActivity.date). */
  dates: string[];
  /** [startUtc, endUtc) — instants for timestamp columns. */
  startUtc: Date;
  endUtc: Date;
  /** e.g. "28 Sep to 4 Oct" */
  label: string;
}

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The IST calendar day of an instant, as "YYYY-MM-DD". */
export const istYmd = (d: Date): string => ymd(d.getTime() + IST_OFFSET_MS);

/** The IST calendar day of an instant, as "12 Nov". */
export function istDayLabel(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
}

/** "2026-11-09" → "Mon". */
export function weekdayName(dateStr: string): string {
  return WEEKDAYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

/**
 * The week to report, in IST. Sent on a Sunday → the week that ends today.
 * Sent any other day → the last fully completed week (Mon–Sun).
 */
export function reportWeekFor(now: Date = new Date()): ReportWeek {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const todayMidnightIstAsUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const dow = ist.getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1 + 7;
  const mondayMs = todayMidnightIstAsUtc - back * DAY_MS;
  const dates = Array.from({ length: 7 }, (_, i) => ymd(mondayMs + i * DAY_MS));
  const startUtc = new Date(mondayMs - IST_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 7 * DAY_MS);
  const f = (s: string) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
  return { start: dates[0], dates, startUtc, endUtc, label: `${f(dates[0])} to ${f(dates[6])}` };
}

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total || 0));
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hs = `${h} hour${h === 1 ? "" : "s"}`;
  return r ? `${hs} ${r} minute${r === 1 ? "" : "s"}` : hs;
}

/** Something the student finished on a given day (lesson, exercise, badge). */
export interface DayItem { title: string; date: string }
/** One quiz sitting: all answers to one lesson's quiz on one day. */
export interface QuizItem { title: string; date: string; correct: number; total: number }

export interface WeekStats {
  minutes: number;
  activeDays: number;
  /** Weekday names of the active days in order, e.g. ["Mon", "Wed"]. */
  activeDayNames: string[];
  lessons: DayItem[];
  exercises: DayItem[];
  quizzes: QuizItem[];
  badges: DayItem[];
  coinsWeek: number;
  coinsTotal: number;
}

export const emptyStats = (): WeekStats => ({
  minutes: 0, activeDays: 0, activeDayNames: [], lessons: [], exercises: [], quizzes: [], badges: [], coinsWeek: 0, coinsTotal: 0,
});

export function hasActivity(s: WeekStats): boolean {
  return s.minutes > 0 || s.lessons.length > 0 || s.exercises.length > 0 || s.quizzes.length > 0 || s.badges.length > 0 || s.coinsWeek > 0;
}

/** WhatsApp variables can't hold line breaks/tabs or long runs of spaces. */
export function cleanParam(v: string, max = 230): string {
  const s = String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, max);
  return s || "-";
}

const shortTitle = (t: string, max = 28) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s || "Lesson";
};

/** "a; b; c; +2 more" — at most `max` items are spelled out. */
export function listItems(items: string[], max = 3): string {
  const shown = items.slice(0, max).join("; ");
  return items.length > max ? `${shown}; +${items.length - max} more` : shown;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function countWithItems(n: number, noun: string, items: string[]): string {
  return n === 0 ? "none this week" : `${plural(n, noun)} (${listItems(items)})`;
}

export function lessonsText(s: WeekStats): string {
  return countWithItems(s.lessons.length, "lesson", s.lessons.map((l) => `${shortTitle(l.title)} on ${l.date}`));
}

export function exercisesText(s: WeekStats): string {
  return countWithItems(s.exercises.length, "exercise", s.exercises.map((e) => `${shortTitle(e.title)} on ${e.date}`));
}

export function quizzesText(s: WeekStats): string {
  return countWithItems(s.quizzes.length, "quiz", s.quizzes.map((q) => `${shortTitle(q.title)} on ${q.date}, score ${q.correct}/${q.total}`));
}

export function rewardsText(s: WeekStats): string {
  const coins = s.coinsWeek > 0 ? `${plural(s.coinsWeek, "coin")} earned this week` : "no coins earned this week";
  const total = `${s.coinsTotal} in total`;
  const badges = s.badges.length ? `. Badges: ${listItems(s.badges.map((b) => `${shortTitle(b.title, 36)} on ${b.date}`), 2)}` : "";
  return `${coins}, ${total}${badges}`;
}

export function activeDaysText(s: WeekStats): string {
  const days = Math.min(7, s.activeDays);
  return days > 0 && s.activeDayNames.length ? `${days} of 7 (${s.activeDayNames.join(", ")})` : `${days} of 7`;
}

/** A short, kind summary for the parent. Low or no activity gets a polite nudge. */
export function overallRemark(studentName: string, s: WeekStats): string {
  const name = studentName.trim().split(/\s+/)[0] || "Your child";
  const quizTotal = s.quizzes.reduce((n, q) => n + q.total, 0);
  const quizCorrect = s.quizzes.reduce((n, q) => n + q.correct, 0);
  const accuracy = quizTotal > 0 ? quizCorrect / quizTotal : null;

  let remark: string;
  if (!hasActivity(s)) {
    remark = `No learning was recorded this week. Spending even 20 minutes a day on coding builds strong skills, so please encourage ${name} to make time for skill development.`;
  } else if (s.minutes < 60 || s.activeDays <= 2) {
    remark = `${name} spent less time learning this week. A little time each day on skill development goes a long way, so please encourage regular practice.`;
  } else if (s.activeDays >= 5 || s.minutes >= 300) {
    remark = `Excellent work! ${name} was very consistent this week. Keep it up.`;
  } else {
    remark = `Good progress this week. A few more minutes of practice each day will help ${name} improve even faster.`;
  }
  if (accuracy !== null && accuracy < 0.5 && hasActivity(s)) {
    remark += " A little revision before quizzes will help improve the scores.";
  }
  return remark;
}

export function buildTemplateParams(input: {
  parentName?: string | null;
  studentName: string;
  week: ReportWeek;
  stats: WeekStats;
}): string[] {
  const { parentName, studentName, week, stats } = input;
  return [
    cleanParam(parentName?.trim() || "Parent", 60),
    cleanParam(studentName, 60),
    cleanParam(week.label, 40),
    cleanParam(stats.minutes > 0 ? formatMinutes(stats.minutes) : "no time recorded", 40),
    cleanParam(activeDaysText(stats), 80),
    cleanParam(lessonsText(stats)),
    cleanParam(exercisesText(stats)),
    cleanParam(quizzesText(stats)),
    cleanParam(rewardsText(stats)),
    cleanParam(overallRemark(studentName, stats), 280),
  ];
}

/** What the parent will read (used by the admin preview and test-as-text mode). */
export function renderPreviewText(p: string[]): string {
  return (
    `Hello ${p[0]}, here is the weekly learning report from CodingKida for ${p[1]} (${p[2]}).\n\n` +
    `Learning time: ${p[3]}.\n` +
    `Active days: ${p[4]}.\n` +
    `Lessons completed: ${p[5]}.\n` +
    `Coding exercises completed: ${p[6]}.\n` +
    `Quizzes: ${p[7]}.\n` +
    `Rewards: ${p[8]}.\n\n` +
    `${p[9]}\n\n` +
    `You can see the full report in the CodingKida app. Thank you for supporting your child's learning.`
  );
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
