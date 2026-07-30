import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { createRateLimiter } from "@/app/lib/rate-limit";
import {
  executeCode,
  isExecutionAvailable,
  VALID_LANGUAGE_IDS,
  LANGUAGE_NAMES,
  MAX_SOURCE_CODE_SIZE,
} from "@/app/lib/code-runner";

/**
 * POST /api/code/submit
 * 
 * Submit code against all test cases (including hidden ones) — for "Submit" button.
 * Security: Auth, Rate limiting, Size limits, Max 20 test cases.
 */

const MAX_TEST_CASES_PER_RUN = 20;
const submitLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const { error, user } = requireAuth(req);
    if (error) return error;

    // 2. Rate limiting
    if (!submitLimiter.check(user!.userId)) {
      return apiError(429, "Rate limit exceeded. Maximum 5 submissions per minute. Please wait.");
    }

    const { exerciseId, source_code, language_id, courseId } = await req.json();

    // 3. Validate
    if (!exerciseId || !source_code?.trim() || !language_id || !courseId) {
      return apiError(400, "exerciseId, source_code, language_id, and courseId are required.");
    }
    if (source_code.length > MAX_SOURCE_CODE_SIZE) return apiError(400, "Source code too large. Maximum 50 KB allowed.");
    if (!VALID_LANGUAGE_IDS.includes(Number(language_id))) return apiError(400, "Invalid language_id.");
    if (!isExecutionAvailable()) return apiError(503, "No code execution engine configured.");

    // 4. Get exercise and test cases
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { testCases: { orderBy: { order: "asc" }, take: MAX_TEST_CASES_PER_RUN } },
    });
    if (!exercise) return apiError(404, "Exercise not found.");

    const testCases = exercise.testCases;

    // No test cases — accept submission directly
    if (testCases.length === 0) {
      const submission = await prisma.exerciseSubmission.create({
        data: { userId: user!.userId, exerciseId, courseId, code: source_code.trim(), language: LANGUAGE_NAMES[Number(language_id)] || null, status: "submitted", passed: true },
      });
      return apiSuccess({ passed: true, total_tests: 0, passed_tests: 0, results: [], submission_id: submission.id, message: "Solution submitted successfully. No test cases configured." });
    }

    // 5. Execute against all test cases
    const results: Array<{ test_case: number; passed: boolean; input: string; expected: string; actual: string; status: string; time: string | null; memory: number | null; is_hidden: boolean }> = [];
    let allPassed = true;
    let totalTime = 0;
    let maxMemory = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      try {
        const execResult = await executeCode({ sourceCode: source_code, languageId: Number(language_id), stdin: tc.input });
        const stdout = execResult.stdout.trim();
        const expected = tc.expectedOutput.trim();
        let statusStr = execResult.status;
        const tcPassed = statusStr === "accepted" && stdout === expected;

        if (!tcPassed) { allPassed = false; if (statusStr === "accepted") statusStr = "wrong_answer"; }
        if (execResult.time) totalTime += parseFloat(execResult.time) * 1000;
        if (execResult.memory && execResult.memory > maxMemory) maxMemory = execResult.memory;

        results.push({
          test_case: i + 1, passed: tcPassed,
          input: tc.isHidden ? "(hidden)" : tc.input,
          expected: tc.isHidden ? "(hidden)" : tc.expectedOutput,
          actual: tc.isHidden ? (tcPassed ? "(correct)" : "(wrong)") : (stdout || execResult.stderr || execResult.compile_output || "No output"),
          status: statusStr, time: execResult.time, memory: execResult.memory, is_hidden: tc.isHidden,
        });

        // Stop on compilation error — skip remaining
        if (statusStr === "compilation_error") {
          for (let j = i + 1; j < testCases.length; j++) {
            results.push({ test_case: j + 1, passed: false, input: testCases[j].isHidden ? "(hidden)" : testCases[j].input, expected: testCases[j].isHidden ? "(hidden)" : testCases[j].expectedOutput, actual: "Skipped (compilation error)", status: "compilation_error", time: null, memory: null, is_hidden: testCases[j].isHidden });
          }
          allPassed = false;
          break;
        }
      } catch {
        results.push({ test_case: i + 1, passed: false, input: tc.isHidden ? "(hidden)" : tc.input, expected: tc.isHidden ? "(hidden)" : tc.expectedOutput, actual: "Execution service error", status: "internal_error", time: null, memory: null, is_hidden: tc.isHidden });
        allPassed = false;
      }
    }

    // 6. Determine overall status
    const passedCount = results.filter((r) => r.passed).length;
    let overallStatus = "wrong_answer";
    if (allPassed) overallStatus = "accepted";
    else if (results.some((r) => r.status === "compilation_error")) overallStatus = "compilation_error";
    else if (results.some((r) => r.status === "time_limit")) overallStatus = "time_limit";
    else if (results.some((r) => r.status === "runtime_error")) overallStatus = "runtime_error";

    // 7. Save submission
    const submission = await prisma.exerciseSubmission.create({
      data: {
        userId: user!.userId, exerciseId, courseId,
        code: source_code.trim(),
        language: LANGUAGE_NAMES[Number(language_id)] || null,
        passed: allPassed, status: overallStatus,
        executionTime: Math.round(totalTime) || null,
        memoryUsed: maxMemory || null,
        output: results.map((r) => `TC${r.test_case}: ${r.status}`).join(" | "),
      },
    });

    return apiSuccess({
      passed: allPassed,
      total_tests: testCases.length,
      passed_tests: passedCount,
      results,
      submission_id: submission.id,
      time: totalTime > 0 ? (totalTime / 1000).toFixed(3) + "s" : null,
      memory: maxMemory > 0 ? Math.round(maxMemory / 1024) + " MB" : null,
      message: allPassed ? `All ${testCases.length} test cases passed! 🎉` : `${passedCount}/${testCases.length} test cases passed.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("jwt") || msg.includes("token")) return apiError(401, "Unauthorized.");
    console.error("Code submit error:", err);
    return apiError(500, "Internal server error.");
  }
}
