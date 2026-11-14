/**
 * Weekly parent report — pure helpers (no database, easy to test).
 *
 * The WhatsApp template ({{1}}…{{6}}) is fixed once Meta approves it:
 *   Hello {{1}}, here is the weekly learning update from CodingKida for {{2}},
 *   covering {{3}}.
 *   Time spent learning: {{4}} across {{5}} active days. Progress this week: {{6}}.
 *   You can see the full report in the CodingKida app. Thank you for supporting
 *   your child's learning.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

export interface WeekStats {
  minutes: number;
  activeDays: number;
  lessons: number;
  quizAttempts: number;
  quizCorrect: number;
  exercisesPassed: number;
  coins: number;
}

export const emptyStats = (): WeekStats => ({
  minutes: 0, activeDays: 0, lessons: 0, quizAttempts: 0, quizCorrect: 0, exercisesPassed: 0, coins: 0,
});

/** A student with no activity at all is not messaged (a list of zeros isn't kind). */
export function hasActivity(s: WeekStats): boolean {
  return s.minutes > 0 || s.lessons > 0 || s.quizAttempts > 0 || s.exercisesPassed > 0 || s.coins > 0;
}

/** One short sentence for {{6}}. */
export function progressSummary(s: WeekStats): string {
  const parts: string[] = [];
  if (s.lessons > 0) parts.push(`${s.lessons} lesson${s.lessons === 1 ? "" : "s"} completed`);
  if (s.quizAttempts > 0) {
    const pct = Math.round((s.quizCorrect / s.quizAttempts) * 100);
    parts.push(`${s.quizAttempts} quiz${s.quizAttempts === 1 ? "" : "zes"} with ${pct}% correct`);
  }
  if (s.exercisesPassed > 0) parts.push(`${s.exercisesPassed} coding exercise${s.exercisesPassed === 1 ? "" : "s"} passed`);
  if (s.coins > 0) parts.push(`${s.coins} coin${s.coins === 1 ? "" : "s"} earned`);
  return parts.length ? parts.join(", ") : "just getting started";
}

/** WhatsApp variables can't hold line breaks/tabs or long runs of spaces. */
export function cleanParam(v: string, max = 200): string {
  const s = String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, max);
  return s || "-";
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
    cleanParam(formatMinutes(stats.minutes), 40),
    cleanParam(String(Math.min(7, stats.activeDays)), 10), // reads "…across 4 active days"
    cleanParam(progressSummary(stats), 250),
  ];
}

/** What the parent will read (used by the admin preview). */
export function renderPreviewText(p: string[]): string {
  return (
    `Hello ${p[0]}, here is the weekly learning update from CodingKida for ${p[1]}, covering ${p[2]}.\n\n` +
    `Time spent learning: ${p[3]} across ${p[4]} active days. Progress this week: ${p[5]}.\n\n` +
    `You can see the full report in the CodingKida app. Thank you for supporting your child's learning.`
  );
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
