import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { createRateLimiter } from "@/app/lib/rate-limit";
import { logger } from "@/app/lib/logger";
import { executeCode, isExecutionAvailable, VALID_LANGUAGE_IDS, MAX_SOURCE_CODE_SIZE } from "@/app/lib/code-runner";
import { notifyCoinsEarned } from "@/app/lib/notification";
import { currentWeek, weeklyExercise, awardWeekly } from "@/app/services/weekly-coding.service";

const MAX_TESTS = 20;
const submitLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/**
 * POST /api/weekly-coding/submit  body: { exerciseId, source_code, language_id }
 * Runs the code against every test case of THIS week's challenge. All passed →
 * 10 coins (once per week). Open to every signed-in student (no course needed).
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;
    if (!submitLimiter.check(user!.userId)) {
      return apiError(429, "Too many submissions. Please wait a minute and try again.");
    }

    const body = await req.json().catch(() => ({}));
    const exerciseId = String(body?.exerciseId ?? "");
    const source = String(body?.source_code ?? "");
    const languageId = Number(body?.language_id);
    if (!exerciseId || !source.trim() || !languageId) return apiError(400, "exerciseId, source_code and language_id are required.");
    if (source.length > MAX_SOURCE_CODE_SIZE) return apiError(400, "Code is too long. Maximum 50 KB.");
    if (!VALID_LANGUAGE_IDS.includes(languageId)) return apiError(400, "Invalid language.");
    if (!isExecutionAvailable()) return apiError(503, "Code running is not available right now.");

    const week = currentWeek();
    const ex = await weeklyExercise(week.key);
    if (!ex || ex.id !== exerciseId) {
      return apiError(409, "This is not this week's challenge any more. Please reload.");
    }
    const tests = await prisma.testCase.findMany({
      where: { exerciseId }, orderBy: { order: "asc" }, take: MAX_TESTS,
      select: { input: true, expectedOutput: true, isHidden: true },
    });
    if (tests.length === 0) return apiError(409, "This challenge has no tests. Please reload.");

    const results: { test_case: number; passed: boolean; input: string; expected: string; actual: string; status: string; is_hidden: boolean }[] = [];
    for (let i = 0; i < tests.length; i++) {
      const tc = tests[i];
      let status = "internal_error";
      let actual = "Execution service error";
      let passed = false;
      try {
        const r = await executeCode({ sourceCode: source, languageId, stdin: tc.input });
        const out = r.stdout.trim();
        passed = r.status === "accepted" && out === tc.expectedOutput.trim();
        status = passed ? "accepted" : r.status === "accepted" ? "wrong_answer" : r.status;
        actual = out || r.stderr || r.compile_output || "No output";
      } catch { /* keep internal_error */ }
      results.push({
        test_case: i + 1, passed, status, is_hidden: tc.isHidden,
        input: tc.isHidden ? "(hidden)" : tc.input,
        expected: tc.isHidden ? "(hidden)" : tc.expectedOutput,
        actual: tc.isHidden ? (passed ? "(correct)" : "(wrong)") : actual,
      });
      // A compile error fails every test the same way: stop early.
      if (status === "compilation_error") break;
    }
    const passedCount = results.filter((r) => r.passed).length;
    const allPassed = passedCount === tests.length;

    let coinsAwarded = 0;
    if (allPassed) {
      const courseId = ex.lesson?.module?.courseId ?? null;
      coinsAwarded = await awardWeekly(user!.userId, week.key, ex.title, courseId);
      if (coinsAwarded > 0) {
        notifyCoinsEarned({
          userId: user!.userId, coins: coinsAwarded, reason: "Weekly Coding Challenge",
          idempotencyKey: `weekly-code:${week.key}`,
        }).catch(() => {});
      }
    }

    return apiSuccess({
      passed: allPassed,
      total_tests: tests.length,
      passed_tests: passedCount,
      results,
      coinsAwarded,
      message: allPassed
        ? coinsAwarded > 0
          ? `All ${tests.length} tests passed! +${coinsAwarded} coins 🎉`
          : `All ${tests.length} tests passed! You already got this week's coins.`
        : `${passedCount}/${tests.length} tests passed. Try again!`,
    });
  } catch (err) {
    logger.error("weekly-coding", "submit_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
