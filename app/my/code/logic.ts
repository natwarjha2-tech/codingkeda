/**
 * Code Editor logic, ported from the desktop app (coding-playground.js) so the
 * website behaves the same: saved code per problem+language, submission
 * history, Coding Score (points, coins, 7-day streak), My Problems, and the
 * pattern-based Hints / Algorithm helpers.
 * Everything here is stored in this browser, exactly like the desktop.
 */

export type TestCase = { input: string; expectedOutput: string; isHidden?: boolean };
export type Problem = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard" | string;
  defaultLanguage?: string;
  lockedLanguage?: boolean;
  inputFormat?: string;
  outputFormat?: string;
  explanation?: string;
  constraints?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  starterCode?: Record<string, string>;
  testCases?: TestCase[];
  hints?: string[];
  tags?: string[];
  // course exercise context (opened from a lesson)
  courseId?: string;
  lessonId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bestSolution?: any;
};
export type Submission = { status: string; passed: boolean; language: string; passedCount?: number; totalCount?: number; createdAt: string };
export type Solved = { problemId: string; title: string; difficulty: string; points: number; coins: number; solvedAt: string; language: string };
export type Score = { solvedProblems: Solved[]; totalPoints: number; totalCoins: number; submissionCalendar: Record<string, number>; streakRewards: string[] };

export const CODING_POINTS: Record<string, number> = { easy: 2, medium: 4, hard: 8 };
export const DIFF_COLORS: Record<string, string> = { easy: "#22c55e", medium: "#f59e0b", hard: "#ef4444" };

const get = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const put = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full/blocked */ } };

/* ── saved code ── */
export const codeKey = (who: string, pid: string, lang: string) => `ck_pg_${who}_${pid}_${lang}`;
export function restoreCode(who: string, pid: string, lang: string): string | null {
  try { return localStorage.getItem(codeKey(who, pid, lang)); } catch { return null; }
}
export function saveCode(who: string, pid: string, lang: string, code: string) {
  try { localStorage.setItem(codeKey(who, pid, lang), code); } catch { /* ignore */ }
}

/* ── submission history (last 10) ── */
export const getSubmissions = (who: string, pid: string) => get<Submission[]>(`ck_pg_subs_${who}_${pid}`, []);
export function addSubmission(who: string, pid: string, s: Omit<Submission, "createdAt">) {
  put(`ck_pg_subs_${who}_${pid}`, [{ ...s, createdAt: new Date().toISOString() }, ...getSubmissions(who, pid)].slice(0, 10));
}

/* ── my problems ── */
export const getMyProblems = (who: string) => get<Problem[]>(`ck_my_problems_${who}`, []);
export const saveMyProblems = (who: string, list: Problem[]) => put(`ck_my_problems_${who}`, list);

/* ── coding score ── */
export function getScore(who: string): Score {
  const d = get<Partial<Score>>(`ck_coding_score_${who}`, {});
  return { solvedProblems: d.solvedProblems || [], totalPoints: d.totalPoints || 0, totalCoins: d.totalCoins || 0, submissionCalendar: d.submissionCalendar || {}, streakRewards: d.streakRewards || [] };
}
const dayKey = (d: Date) => d.toISOString().split("T")[0];

export function currentStreak(score: Score, maxDays = 365): number {
  let n = 0;
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if ((score.submissionCalendar[dayKey(d)] || 0) > 0) n++; else break;
  }
  return n;
}

/** First accepted solve of a problem → points + coins (and a 7-day streak bonus). */
export function awardSolve(who: string, p: Problem, language: string): { awarded: boolean; points?: number; coins?: number; streakBonus?: boolean } {
  const s = getScore(who);
  if (s.solvedProblems.some((x) => x.problemId === p.id)) return { awarded: false };
  const points = CODING_POINTS[p.difficulty] || 2;
  const coins = points * 2;
  s.solvedProblems.push({ problemId: p.id, title: p.title, difficulty: p.difficulty, points, coins, solvedAt: new Date().toISOString(), language });
  s.totalPoints += points;
  s.totalCoins += coins;
  const today = dayKey(new Date());
  s.submissionCalendar[today] = (s.submissionCalendar[today] || 0) + 1;

  let streakBonus = false;
  const streak = currentStreak(s, 30);
  if (streak >= 7 && streak % 7 === 0) {
    const start = new Date(); start.setDate(start.getDate() - 6);
    const k = `${dayKey(start)}_to_${today}`;
    if (!s.streakRewards.includes(k)) { s.streakRewards.push(k); s.totalCoins += 10; streakBonus = true; }
  }
  put(`ck_coding_score_${who}`, s);
  return { awarded: true, points, coins, streakBonus };
}

/* ── helpers ── */
export function filenameFromTitle(title: string, ext: string) {
  const words = (title || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return `solution${ext}`;
  const camel = words.map((w, i) => {
    const c = w.replace(/[^A-Za-z0-9]/g, "");
    return i === 0 ? c.toLowerCase() : c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
  }).join("");
  return (camel || "solution") + ext;
}

export function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h} hour${h > 1 ? "s" : ""} ago`; }
  if (diff < 604800) { const d = Math.floor(diff / 86400); return `${d} day${d > 1 ? "s" : ""} ago`; }
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Desktop "Format" for C / Java / Python (JavaScript uses Monaco's formatter). */
export function formatIndent(code: string, langId: string): string {
  if (!code.trim()) return code;
  const collapse = (lines: string[]) => {
    const out: string[] = [];
    let prev = false;
    for (const l of lines) { const blank = !l.trim(); if (blank && prev) continue; out.push(l); prev = blank; }
    while (out.length && !out[out.length - 1].trim()) out.pop();
    return out.join("\n");
  };
  if (langId === "python") return collapse(code.split("\n").map((l) => l.replace(/\t/g, "    ").replace(/\s+$/, "")));
  let indent = 0;
  const out = code.split("\n").map((raw) => {
    const line = raw.trim();
    if (!line) return "";
    if (/^[}\]]/.test(line) && indent > 0) indent--;
    const res = "    ".repeat(indent) + line;
    const opens = (line.match(/[{]/g) || []).length;
    const closes = (line.match(/[}]/g) || []).length - (/^[}]/.test(line) ? 1 : 0);
    indent = Math.max(0, indent + opens - closes);
    return res;
  });
  return collapse(out);
}

/* ── AI ▾ helpers (pattern-based, from the stored best solution; no API) ── */
export function extractHints(code: string): string[] {
  if (!code) return ["Think about the problem step by step."];
  const h: string[] = [];
  if (/\bMap\b|\bHashMap\b|\bdict\b|\bunordered_map\b|\bmap\[/.test(code)) h.push("Consider using a Hash Map/Dictionary for O(1) lookups.");
  if (/\bSet\b|\bHashSet\b|\bset\(\)|\bunordered_set\b/.test(code)) h.push("A Set can help track unique elements efficiently.");
  if (/\bStack\b|\bstack\b|\bLifoQueue\b|\bpush\b.*\bpop\b/.test(code)) h.push("A Stack (LIFO) structure might be useful here.");
  if (/\bQueue\b|\bqueue\b|\bdeque\b|\bLinkedList\b/.test(code)) h.push("Think about using a Queue (FIFO) for processing order.");
  if (/\bPriorityQueue\b|\bheapq\b|\bheap\b/.test(code)) h.push("A Priority Queue/Heap can optimize finding min/max efficiently.");
  if (/\bsort\b|\bArrays\.sort\b|\bsorted\b/.test(code)) h.push("Sorting the input first might simplify the problem.");
  if (/while.*left.*right|while.*lo.*hi|while.*start.*end/.test(code)) h.push("Two-pointer or Binary Search technique could work here.");
  if (/\(.*n\s*-\s*1\)|\(.*n\s*\/\s*2\)|\brecur/.test(code)) h.push("This problem might benefit from a recursive/divide-and-conquer approach.");
  if (/\bdp\b|\bmemo\b|\bcache\b|\btabulation\b/.test(code)) h.push("Dynamic Programming (memoization/tabulation) is key to optimal solution.");
  if (/for.*for|while.*while/.test(code) && !/\bdp\b/.test(code)) h.push("Nested iteration is used — think about optimizing inner loop.");
  if (/Math\.max|Math\.min|max\(|min\(|fmax|fmin/.test(code)) h.push("Track running maximum/minimum values as you iterate.");
  if (/\bswap\b|temp\s*=/.test(code)) h.push("In-place swapping technique is part of the solution.");
  if (/\^=|\^\s/.test(code)) h.push("XOR bitwise operation has a useful property here.");
  if (/\.length|\.size|len\(/.test(code) && /-\s*1/.test(code)) h.push("Pay attention to array bounds (length - 1).");
  if (!h.length) {
    const loops = (code.match(/\bfor\b|\bwhile\b/g) || []).length;
    if (loops === 1) h.push("A single pass through the data is sufficient.");
    else if (loops === 2) h.push("Two passes (or a nested structure) are needed.");
    h.push("Break the problem into smaller sub-problems.");
    h.push("Think about edge cases: empty input, single element, duplicates.");
  }
  if (h.length < 4) h.push("Read input carefully and handle edge cases first.");
  return h.slice(0, 5);
}

export function detectAlgorithm(code: string): { name: string; explanation: string; steps: string[] } {
  if (!code) return { name: "Unknown", explanation: "Could not analyze.", steps: [] };
  if (/while.*left.*right|while.*lo.*hi|while.*i.*j/.test(code) && /left\+\+|right--|lo\+\+|hi--|i\+\+|j--/.test(code))
    return { name: "Two Pointer Technique", explanation: "Uses two pointers moving from opposite ends (or same direction) to find a solution in O(n) time without extra space. Avoids brute-force nested loops.", steps: ["Initialize two pointers (left at start, right at end)", "Compare elements at both pointers", "Move the pointer that helps approach the target", "Repeat until pointers meet or condition is satisfied"] };
  if (/while.*low.*high|while.*lo.*hi|while.*left.*right/.test(code) && /mid\s*=|mid\s*\+|\/\s*2/.test(code))
    return { name: "Binary Search", explanation: "Divides the search space in half each iteration, achieving O(log n) time complexity. Works on sorted data or monotonic conditions.", steps: ["Define search boundaries (low, high)", "Calculate mid point", "Compare mid with target — narrow search to left or right half", "Repeat until element found or boundaries cross"] };
  if (/\bdp\b|\bmemo\b|\btabulation\b|\bcache\b/.test(code))
    return { name: "Dynamic Programming", explanation: "Breaks problem into overlapping sub-problems and stores results to avoid recomputation. Builds solution bottom-up (tabulation) or top-down (memoization).", steps: ["Identify the state (what changes between sub-problems)", "Define recurrence relation (how states relate)", "Initialize base cases", "Fill DP table iteratively or recursively with memoization", "Return final state as answer"] };
  if (/def\s+\w+.*:[\s\S]{0,200}def\s+\w+/.test(code) || /\bbacktrack\b|\brecurse\b/.test(code))
    return { name: "Recursion / Backtracking", explanation: "Explores all possible solutions by making choices and undoing them (backtracking) when they lead to dead ends. Useful for combinatorial problems.", steps: ["Define base case (when to stop)", "Make a choice and recurse on remaining sub-problem", "If choice leads to invalid state, undo (backtrack)", "Collect valid solutions"] };
  if (/\bsort\b|\bArrays\.sort\b|\bsorted\b|\bCollections\.sort\b/.test(code)) {
    if (/greedy|max.*min|min.*max/.test(code) || !/for.*for/.test(code))
      return { name: "Sorting + Greedy Approach", explanation: "Sorts input to establish order, then makes locally optimal choices at each step. Greedy works when local optimum leads to global optimum.", steps: ["Sort the input array/list", "Iterate through sorted data", "At each step, make the greedy choice (pick best local option)", "Build result incrementally"] };
    return { name: "Sorting-Based Approach", explanation: "Sorts the input first to simplify the problem. After sorting, patterns become easier to detect (duplicates, pairs, ranges).", steps: ["Sort the input data", "Use the sorted order to efficiently find answer", "Handle edge cases (empty array, single element)"] };
  }
  if (/\bMap\b|\bHashMap\b|\bdict\b|\bunordered_map\b|\bmap\[/.test(code) && /\bget\b|\[.*\]\s*=/.test(code))
    return { name: "Hash Map / Frequency Counting", explanation: "Uses a hash map to store values for O(1) lookup. Common for counting frequencies, finding pairs, or tracking seen elements.", steps: ["Create a hash map/dictionary", "Iterate through input, storing relevant data in map", "Use O(1) lookup to check conditions or find answers", "Return result based on map contents"] };
  if (/window|slide|shrink/.test(code))
    return { name: "Sliding Window", explanation: "Maintains a window of elements that expands or shrinks based on conditions. Efficiently processes contiguous subarrays/substrings in O(n).", steps: ["Initialize window boundaries (start, end)", "Expand window by moving end pointer", "When condition violated, shrink window from start", "Track best result (max/min) during process"] };
  if ((code.match(/\bfor\b|\bwhile\b/g) || []).length === 1)
    return { name: "Single-Pass Linear Scan", explanation: "Solves the problem in a single pass through the data (O(n)). Maintains running state variables to track the answer.", steps: ["Initialize result/tracking variables", "Iterate through input once", "Update tracking variables at each step", "Return final result after loop"] };
  if ((code.match(/\bfor\b/g) || []).length >= 2)
    return { name: "Nested Iteration", explanation: "Uses nested loops to check all pairs or sub-problems. May be O(n²) but is sometimes the simplest correct approach for the given constraints.", steps: ["Outer loop iterates through each element", "Inner loop checks against remaining elements", "Track best result found", "Optimize if possible with early termination"] };
  return { name: "Iterative Approach", explanation: "Uses straightforward iteration to solve the problem. Focus on handling edge cases correctly.", steps: ["Read and parse input", "Process data with appropriate logic", "Handle edge cases", "Output result"] };
}

export const CATEGORIES = [
  "Basic Input / Output", "Variables & Data Types", "Arithmetic / Maths Programs", "Number Programs", "Operators & Expressions",
  "Conditional / If-Else", "Switch / Menu-Driven", "Loops / Iterations", "Pattern Programs", "Number Series", "Functions / Methods",
  "Recursion", "1D Arrays / Lists", "2D Arrays / Matrices", "Searching", "Sorting", "Strings", "Characters", "Pointers (C)",
  "Dynamic Memory Management (C)", "Structures & Unions (C)", "Collections / Data Structures", "Object-Oriented Programming (OOP)",
  "File Handling", "Exception / Error Handling", "Database / SQL", "APIs / JSON", "Data Analysis / NumPy / Pandas",
  "Multithreading / Concurrency", "GUI / Application Development", "Testing / Debugging / Code Quality", "Build Tools / Version Control",
  "General Programming / Mixed Problems", "Other / Miscellaneous",
];
