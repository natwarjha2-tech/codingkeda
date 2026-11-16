/**
 * Daily activity — the single description of "what the student did on a day".
 * The My Report calendar popup (mobile + desktop) and the weekly parent report
 * are both built from exactly this shape, so they can never disagree.
 */

export interface DayLesson { title: string; module: string | null; course: string | null; at: string }
/** One quiz sitting: all answers to one lesson's quiz on one day. */
export interface DayQuiz { lesson: string; module: string | null; course: string | null; correct: number; total: number; at: string }
export interface DayExercise { title: string; lesson: string | null; module: string | null; course: string | null; language: string | null; passed: boolean; attempts: number; at: string }
export interface DayCoin { type: string; coins: number; reason: string; lesson: string | null; module: string | null; course: string | null; at: string }
export interface DayBadge { title: string; lesson: string; module: string | null; course: string | null; at: string }

export interface DayActivity {
  /** "YYYY-MM-DD" (IST). */
  date: string;
  minutes: number;
  sessions: number;
  lessons: DayLesson[];
  quizzes: DayQuiz[];
  exercises: DayExercise[];
  coins: DayCoin[];
  badges: DayBadge[];
}

export const emptyDay = (date: string): DayActivity => ({
  date, minutes: 0, sessions: 0, lessons: [], quizzes: [], exercises: [], coins: [], badges: [],
});
