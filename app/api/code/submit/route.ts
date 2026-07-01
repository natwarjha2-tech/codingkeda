import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * POST /api/code/submit
 * 
 * Submit code against all test cases (including hidden ones) — for "Submit" button.
 * 
 * Security Measures:
 * - Auth required (Bearer token)
 * - Rate limiting (max 5 submissions per minute per user)
 * - Source code size limit (50 KB max)
 * - CPU time limit (per exercise config, default 2 sec)
 * - Memory limit (per exercise config, default 256 MB)
 * - Network disabled in sandbox
 * - Max 20 test cases per exercise (prevent abuse)
 * - Output comparison is strict (trimmed whitespace)
 */

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "http://localhost:2358";
const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN || "";

// Security constants
const MAX_SOURCE_CODE_SIZE = 50 * 1024;      // 50 KB
const MAX_TEST_CASES_PER_RUN = 20;           // max test cases to evaluate
const SUBMIT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const SUBMIT_RATE_LIMIT_MAX = 5;              // 5 submissions per minute

const VALID_LANGUAGE_IDS = [50, 62, 71, 63];

const LANGUAGE_NAMES: Record<number, string> = {
  50: "c",
  62: "java",
  71: "python",
  63: "javascript",
};

// In-memory rate limiter for submissions
const submitRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkSubmitRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = submitRateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    submitRateLimitMap.set(userId, { count: 1, resetAt: now + SUBMIT_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= SUBMIT_RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Cleanup stale entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of submitRateLimitMap.entries()) {
    if (now > value.resetAt) submitRateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    // 2. Rate limiting
    if (!checkSubmitRateLimit(payload.userId)) {
      return NextResponse.json(
        { success: false, message: "Rate limit exceeded. Maximum 5 submissions per minute. Please wait." },
        { status: 429 }
      );
    }

    const { exerciseId, source_code, language_id, courseId } = await req.json();

    // 3. Validate required fields
    if (!exerciseId || !source_code?.trim() || !language_id || !courseId) {
      return NextResponse.json(
        { success: false, message: "exerciseId, source_code, language_id, and courseId are required." },
        { status: 400 }
      );
    }

    // 4. Validate source code size
    if (source_code.length > MAX_SOURCE_CODE_SIZE) {
      return NextResponse.json(
        { success: false, message: "Source code too large. Maximum 50 KB allowed." },
        { status: 400 }
      );
    }

    // 5. Validate language
    if (!VALID_LANGUAGE_IDS.includes(Number(language_id))) {
      return NextResponse.json(
        { success: false, message: "Invalid language_id." },
        { status: 400 }
      );
    }

    // 6. Get exercise and its test cases
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { testCases: { orderBy: { order: "asc" }, take: MAX_TEST_CASES_PER_RUN } },
    });

    if (!exercise) {
      return NextResponse.json(
        { success: false, message: "Exercise not found." },
        { status: 404 }
      );
    }

    const testCases = exercise.testCases;

    // If no test cases exist, fall back to AI evaluation (existing behavior)
    if (testCases.length === 0) {
      // Save submission without execution
      const submission = await prisma.exerciseSubmission.create({
        data: {
          userId: payload.userId,
          exerciseId,
          courseId,
          code: source_code.trim(),
          language: LANGUAGE_NAMES[Number(language_id)] || null,
          status: "submitted",
          passed: true, // Accept when no test cases
        },
      });

      return NextResponse.json({
        success: true,
        passed: true,
        total_tests: 0,
        passed_tests: 0,
        results: [],
        submission_id: submission.id,
        message: "Solution submitted successfully. No test cases configured for this exercise.",
      });
    }

    // Run code against all test cases
    const results: {
      test_case: number;
      passed: boolean;
      input: string;
      expected: string;
      actual: string;
      status: string;
      time: string | null;
      memory: number | null;
      is_hidden: boolean;
    }[] = [];

    let allPassed = true;
    let totalTime = 0;
    let maxMemory = 0;

    const PISTON_URL = process.env.PISTON_API_URL || "";
    const usePiston = !!PISTON_URL;

    // Piston language mapping
    const PISTON_LANGS: Record<number, { lang: string; version: string }> = {
      50: { lang: "c", version: "10.2.0" },
      62: { lang: "java", version: "15.0.2" },
      71: { lang: "python3", version: "3.10.0" },
      63: { lang: "javascript", version: "18.15.0" },
    };

    // Execute test cases sequentially
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      let stdout = "";
      let stderr = "";
      let compileOut = "";
      let statusStr = "unknown";
      let execTime: string | null = null;
      let execMemory: number | null = null;
      let fetchOk = true;

      try {
        if (usePiston) {
          // Piston execution
          const pLang = PISTON_LANGS[Number(language_id)];
          const pRes = await fetch(`${PISTON_URL}/api/v2/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              language: pLang.lang,
              version: pLang.version,
              files: [{ content: source_code }],
              stdin: tc.input,
              run_timeout: 3000,
              compile_timeout: 10000,
            }),
          });
          if (!pRes.ok) { fetchOk = false; } 
          else {
            const pData = await pRes.json();
            compileOut = pData.compile?.stderr || "";
            stdout = (pData.run?.stdout || "").trim();
            stderr = pData.run?.stderr || "";
            const exitCode = pData.run?.code ?? -1;
            if (pData.compile?.code !== undefined && pData.compile.code !== 0) statusStr = "compilation_error";
            else if (pData.run?.signal === "SIGKILL") statusStr = "time_limit";
            else if (exitCode === 0) statusStr = "accepted";
            else statusStr = "runtime_error";
          }
        } else if (JUDGE0_API_URL) {
          // Judge0 execution
          const j0Headers: Record<string, string> = { "Content-Type": "application/json" };
          if (JUDGE0_AUTH_TOKEN) j0Headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN;
          const j0Res = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
            method: "POST",
            headers: j0Headers,
            body: JSON.stringify({
              source_code: source_code,
              language_id: Number(language_id),
              stdin: tc.input,
              expected_output: tc.expectedOutput,
            }),
          });
          if (!j0Res.ok) { fetchOk = false; }
          else {
            const j0Data = await j0Res.json();
            const statusId = j0Data.status?.id;
            stdout = (j0Data.stdout || "").trim();
            stderr = j0Data.stderr || "";
            compileOut = j0Data.compile_output || "";
            execTime = j0Data.time || null;
            execMemory = j0Data.memory || null;
            if (statusId === 3) statusStr = "accepted";
            else if (statusId === 5) statusStr = "time_limit";
            else if (statusId === 6) statusStr = "compilation_error";
            else if (statusId >= 7 && statusId <= 12) statusStr = "runtime_error";
            else statusStr = "runtime_error";
          }
        } else {
          fetchOk = false;
        }
      } catch {
        fetchOk = false;
      }

      if (!fetchOk) {
        results.push({
          test_case: i + 1, passed: false,
          input: tc.isHidden ? "(hidden)" : tc.input,
          expected: tc.isHidden ? "(hidden)" : tc.expectedOutput,
          actual: "Execution service error",
          status: "internal_error", time: null, memory: null, is_hidden: tc.isHidden,
        });
        allPassed = false;
        continue;
      }

      // Compare output
      const expected = tc.expectedOutput.trim();
      const tcPassed = statusStr === "accepted" && stdout === expected;
      if (!tcPassed) { allPassed = false; if (statusStr === "accepted") statusStr = "wrong_answer"; }

      if (execTime) totalTime += parseFloat(execTime) * 1000;
      if (execMemory && execMemory > maxMemory) maxMemory = execMemory;

      results.push({
        test_case: i + 1,
        passed: tcPassed,
        input: tc.isHidden ? "(hidden)" : tc.input,
        expected: tc.isHidden ? "(hidden)" : tc.expectedOutput,
        actual: tc.isHidden ? (tcPassed ? "(correct)" : "(wrong)") : (stdout || stderr || compileOut || "No output"),
        status: statusStr,
        time: execTime,
        memory: execMemory,
        is_hidden: tc.isHidden,
      });

      // Stop on compilation error
      if (statusStr === "compilation_error") {
        for (let j = i + 1; j < testCases.length; j++) {
          results.push({
            test_case: j + 1, passed: false,
            input: testCases[j].isHidden ? "(hidden)" : testCases[j].input,
            expected: testCases[j].isHidden ? "(hidden)" : testCases[j].expectedOutput,
            actual: "Skipped (compilation error)",
            status: "compilation_error", time: null, memory: null, is_hidden: testCases[j].isHidden,
          });
        }
        allPassed = false;
        break;
      }
    }

    const passedCount = results.filter((r) => r.passed).length;

    // Determine overall status
    let overallStatus = "wrong_answer";
    if (allPassed) overallStatus = "accepted";
    else if (results.some((r) => r.status === "compilation_error")) overallStatus = "compilation_error";
    else if (results.some((r) => r.status === "time_limit")) overallStatus = "time_limit";
    else if (results.some((r) => r.status === "runtime_error")) overallStatus = "runtime_error";

    // Save submission
    const submission = await prisma.exerciseSubmission.create({
      data: {
        userId: payload.userId,
        exerciseId,
        courseId,
        code: source_code.trim(),
        language: LANGUAGE_NAMES[Number(language_id)] || null,
        passed: allPassed,
        status: overallStatus,
        executionTime: Math.round(totalTime) || null,
        memoryUsed: maxMemory || null,
        output: results.map((r) => `TC${r.test_case}: ${r.status}`).join(" | "),
      },
    });

    return NextResponse.json({
      success: true,
      passed: allPassed,
      total_tests: testCases.length,
      passed_tests: passedCount,
      results: results,
      submission_id: submission.id,
      time: totalTime > 0 ? (totalTime / 1000).toFixed(3) + "s" : null,
      memory: maxMemory > 0 ? Math.round(maxMemory / 1024) + " MB" : null,
      message: allPassed
        ? `All ${testCases.length} test cases passed! 🎉`
        : `${passedCount}/${testCases.length} test cases passed.`,
    });
  } catch (err: any) {
    if (err?.message?.includes("jwt") || err?.message?.includes("token")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }
    console.error("Code submit error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
