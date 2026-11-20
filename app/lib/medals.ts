/**
 * Medal names and rewards for quizzes, coding exercises and the weekly
 * challenge. Browser-safe (no server imports).
 *
 * Quiz badges keep their stored keys ("super-master", "master", "pro") so every
 * badge students already have shows the new name automatically.
 */

export type QuizBadgeKey = "super-master" | "master" | "pro";
export type CodingMedalKey = "coding-gold" | "coding-silver" | "coding-bronze";
export type WeeklyMedalKey = "weekly-champion" | "weekly-finalist" | "weekly-solver";
export type MedalKey = QuizBadgeKey | CodingMedalKey | WeeklyMedalKey;

export interface MedalInfo { key: MedalKey; label: string; icon: string; coins: number; meaning: string }

export const MEDALS: Record<MedalKey, MedalInfo> = {
  "super-master": { key: "super-master", label: "Quiz Gold", icon: "🥇", coins: 10, meaning: "Top score in this lesson's quiz" },
  master: { key: "master", label: "Quiz Silver", icon: "🥈", coins: 7, meaning: "Second best score in this lesson's quiz" },
  pro: { key: "pro", label: "Quiz Bronze", icon: "🥉", coins: 5, meaning: "Top 10 in this lesson's quiz" },
  "coding-gold": { key: "coding-gold", label: "Coding Gold", icon: "🥇", coins: 10, meaning: "First to solve this exercise" },
  "coding-silver": { key: "coding-silver", label: "Coding Silver", icon: "🥈", coins: 7, meaning: "Second to solve this exercise" },
  "coding-bronze": { key: "coding-bronze", label: "Coding Bronze", icon: "🥉", coins: 5, meaning: "Among the first 10 to solve this exercise" },
  "weekly-champion": { key: "weekly-champion", label: "Weekly Champion", icon: "🏆", coins: 15, meaning: "First to solve this week's challenge" },
  "weekly-finalist": { key: "weekly-finalist", label: "Weekly Finalist", icon: "🎖️", coins: 10, meaning: "2nd or 3rd to solve this week's challenge" },
  "weekly-solver": { key: "weekly-solver", label: "Weekly Solver", icon: "✅", coins: 5, meaning: "Solved this week's challenge" },
};

/** Coding exercise medal by solve order (1 = first). Null after rank 10. */
export function codingMedal(rank: number): MedalInfo | null {
  if (rank === 1) return MEDALS["coding-gold"];
  if (rank === 2) return MEDALS["coding-silver"];
  if (rank >= 3 && rank <= 10) return MEDALS["coding-bronze"];
  return null;
}

/** Weekly challenge medal by solve order. Everyone who solves it gets one. */
export function weeklyMedal(rank: number): MedalInfo {
  if (rank === 1) return MEDALS["weekly-champion"];
  if (rank <= 3) return MEDALS["weekly-finalist"];
  return MEDALS["weekly-solver"];
}

/**
 * Turns a stored coin reason into text a student can read.
 * "CodingLB:<id> — Rank #1 — Coding Gold — Two Sum" → "🥇 Coding Gold · Rank #1 · Two Sum".
 * Other reasons (quiz, referral, coupon...) are returned unchanged.
 */
export function friendlyCoinReason(reason: string): string {
  const isLb = reason.startsWith("CodingLB:");
  const isWeekly = reason.startsWith("WeeklyCode:");
  if (isLb || isWeekly) {
    const parts = reason.split(" — ");
    const rank = Number(/Rank #(\d+)/.exec(reason)?.[1] ?? 0);
    const found = Object.values(MEDALS).find((m) => reason.includes(m.label));
    const medal = found ?? (isWeekly ? MEDALS["weekly-solver"] : rank ? codingMedal(rank) : null);
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const title = last.startsWith("Rank #") || (medal && last === medal.label) ? "" : last;
    const head = medal ? `${medal.icon} ${medal.label}` : isWeekly ? "Weekly Challenge" : "Coding Exercise";
    return [head, rank ? `Rank #${rank}` : "", title].filter(Boolean).join(" · ");
  }
  if (reason.startsWith("Coding:")) return `Code Arena · ${reason.slice(7).trim()}`;
  return reason;
}

export function medalLabel(key: string): string {
  return (MEDALS as Record<string, MedalInfo>)[key]?.label ?? key;
}
