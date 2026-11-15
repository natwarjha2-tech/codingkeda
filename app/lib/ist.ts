/** Indian Standard Time helpers shared by the daily activity view and the weekly report. */

export const IST_OFFSET_MS = 330 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Epoch ms → "YYYY-MM-DD" (UTC calendar day of that instant). */
export const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The IST calendar day of an instant, as "YYYY-MM-DD". */
export const istYmd = (d: Date): string => ymd(d.getTime() + IST_OFFSET_MS);

/** "2026-11-12" → "12 Nov". */
export function dateLabel(dateStr: string): string {
  return `${Number(dateStr.slice(8, 10))} ${MONTHS[Number(dateStr.slice(5, 7)) - 1]}`;
}

/** The IST calendar day of an instant, as "12 Nov". */
export const istDayLabel = (d: Date): string => dateLabel(istYmd(d));

/** "2026-11-09" → "Mon". */
export function weekdayName(dateStr: string): string {
  return WEEKDAYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

/** [start, end) instants covering the IST days `from`..`to` inclusive ("YYYY-MM-DD"). */
export function istRangeUtc(from: string, to: string): { startUtc: Date; endUtc: Date } {
  const startMs = Date.parse(`${from}T00:00:00Z`) - IST_OFFSET_MS;
  const endMs = Date.parse(`${to}T00:00:00Z`) + DAY_MS - IST_OFFSET_MS;
  return { startUtc: new Date(startMs), endUtc: new Date(endMs) };
}

/** Every "YYYY-MM-DD" from `from` to `to` inclusive. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let ms = Date.parse(`${from}T00:00:00Z`); ms <= Date.parse(`${to}T00:00:00Z`); ms += DAY_MS) out.push(ymd(ms));
  return out;
}
