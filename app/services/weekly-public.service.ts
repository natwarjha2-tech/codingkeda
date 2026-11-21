import { currentWeek, weeklyExercise, weeklyLeaderboard } from "@/app/services/weekly-coding.service";
import { MEDALS } from "@/app/lib/medals";

/**
 * Public (no login) view of this week's coding challenge for the website.
 * Shows the question, sample tests and the solvers list. No hints, starter
 * code, solutions or hidden tests. Kept in memory for 60 seconds.
 */
export interface PublicWeekly {
  week: { key: string; start: string; end: string };
  exercise: {
    title: string; description: string; difficulty: string; language: string | null;
    inputFormat: string | null; outputFormat: string | null; constraints: string | null;
    courseTitle: string | null;
    samples: { input: string; expectedOutput: string }[];
  } | null;
  rewards: { label: string; icon: string; coins: number; who: string }[];
  leaderboard: { rank: number; name: string; weeksSolved: number }[];
  totalSolvers: number;
}

let cache: { at: number; key: string; data: PublicWeekly } | null = null;

export async function getPublicWeekly(): Promise<PublicWeekly> {
  const week = currentWeek();
  if (cache && cache.key === week.key && Date.now() - cache.at < 60_000) return cache.data;

  const rewards = [
    { ...pick("weekly-champion"), who: "1st to solve" },
    { ...pick("weekly-finalist"), who: "2nd and 3rd" },
    { ...pick("weekly-solver"), who: "Everyone who solves it" },
  ];

  try {
    const [ex, board] = await Promise.all([weeklyExercise(week.key), weeklyLeaderboard(week.key, null)]);
    const data: PublicWeekly = {
      week,
      exercise: ex
        ? {
            title: ex.title, description: ex.description, difficulty: ex.difficulty, language: ex.language,
            inputFormat: ex.inputFormat, outputFormat: ex.outputFormat, constraints: ex.constraints,
            courseTitle: ex.lesson?.module?.course?.title ?? null,
            samples: ex.testCases,
          }
        : null,
      rewards,
      // First names only on the public page.
      leaderboard: board.leaderboard.slice(0, 20).map((r) => ({
        rank: r.rank, name: (r.name || "Student").trim().split(/\s+/)[0], weeksSolved: r.weeksSolved,
      })),
      totalSolvers: board.totalSolvers,
    };
    cache = { at: Date.now(), key: week.key, data };
    return data;
  } catch {
    return cache?.data ?? { week, exercise: null, rewards, leaderboard: [], totalSolvers: 0 };
  }
}

function pick(key: keyof typeof MEDALS) {
  const m = MEDALS[key];
  return { label: m.label, icon: m.icon, coins: m.coins };
}
