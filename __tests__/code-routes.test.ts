/**
 * Unit tests — code execution API routes
 *   • POST /api/code/run
 *   • POST /api/code/submit
 *   • POST /api/code/compile-check
 *   • POST /api/code/analyze-complexity
 *   • POST /api/code/autocomplete
 *   • GET  /api/code/submissions
 *
 * FULLY MOCKED — code-runner (executeCode/isExecutionAvailable), prisma, gemini
 * and logger are all mocked. Auth is REAL (we sign a valid JWT with a test-only
 * secret) so the middleware path is genuinely exercised. The in-memory rate
 * limiter is REAL but keyed per userId, so unique userIds keep tests isolated.
 * No real DB / network / Docker / AI is ever touched.
 */

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-only-jwt-secret-value-0123456789-abcdef";
}

jest.mock("@/app/lib/code-runner", () => {
  const actual = jest.requireActual("@/app/lib/code-runner");
  return {
    ...actual,
    executeCode: jest.fn(),
    isExecutionAvailable: jest.fn(() => true),
  };
});

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    exercise: { findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn() },
    exerciseSubmission: { create: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock("@/app/lib/gemini", () => ({
  callGemini: jest.fn(),
  callGeminiJSON: jest.fn(),
  isGeminiConfigured: jest.fn(() => true),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { POST as runRoute } from "@/app/api/code/run/route";
import { POST as submitRoute } from "@/app/api/code/submit/route";
import { POST as compileRoute } from "@/app/api/code/compile-check/route";
import { POST as analyzeRoute } from "@/app/api/code/analyze-complexity/route";
import { POST as autocompleteRoute } from "@/app/api/code/autocomplete/route";
import { GET as submissionsRoute } from "@/app/api/code/submissions/route";

import { signToken } from "@/app/lib/auth";
import { executeCode, isExecutionAvailable } from "@/app/lib/code-runner";
import { prisma } from "@/app/lib/prisma";
import { callGemini, callGeminiJSON, isGeminiConfigured } from "@/app/lib/gemini";

const mExec = executeCode as jest.MockedFunction<typeof executeCode>;
const mAvail = isExecutionAvailable as jest.MockedFunction<typeof isExecutionAvailable>;
const mExerciseFind = prisma.exercise.findUnique as jest.MockedFunction<typeof prisma.exercise.findUnique>;
const mEnrollFind = prisma.enrollment.findUnique as jest.MockedFunction<typeof prisma.enrollment.findUnique>;
const mSubCreate = prisma.exerciseSubmission.create as jest.MockedFunction<typeof prisma.exerciseSubmission.create>;
const mSubFindMany = prisma.exerciseSubmission.findMany as jest.MockedFunction<typeof prisma.exerciseSubmission.findMany>;
const mGemini = callGemini as jest.MockedFunction<typeof callGemini>;
const mGeminiJSON = callGeminiJSON as jest.MockedFunction<typeof callGeminiJSON>;
const mGeminiCfg = isGeminiConfigured as jest.MockedFunction<typeof isGeminiConfigured>;

/** A fresh, unique userId per request keeps the real rate-limiter from bleeding across tests. */
let userCounter = 0;
function freshToken(role = "user") {
  userCounter += 1;
  return signToken({ userId: `user-${userCounter}`, email: `u${userCounter}@test.com`, role });
}

/** Build a minimal NextRequest-like object the routes can consume. */
function makeReq(body: unknown, token?: string, query?: Record<string, string>) {
  const headers = new Map<string, string>();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const params = new URLSearchParams(query || {});
  return {
    json: async () => body,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    nextUrl: { searchParams: params },
  } as never;
}

async function readJson(res: Response) {
  return (res as unknown as { json: () => Promise<Record<string, unknown>> }).json();
}

// Re-arm default happy-path mocks (clearMocks wipes them before each test).
beforeEach(() => {
  mAvail.mockReturnValue(true);
  mGeminiCfg.mockReturnValue(true);
});

// ─────────────────────────────────────────────────────────────
// POST /api/code/run
// ─────────────────────────────────────────────────────────────
describe("POST /api/code/run", () => {
  it("401 without a token", async () => {
    const res = await runRoute(makeReq({ source_code: "x", language_id: 71 }));
    expect(res.status).toBe(401);
  });

  it("executes and returns output on the happy path", async () => {
    mExec.mockResolvedValue({
      stdout: "5\n", stderr: "", compile_output: "", status: "accepted",
      status_description: "accepted", time: "0.01", memory: 100,
    });
    const res = await runRoute(makeReq({ source_code: "print(5)", language_id: 71, stdin: "" }, freshToken()));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.stdout).toBe("5\n");
  });

  it("400 when source_code is missing", async () => {
    const res = await runRoute(makeReq({ language_id: 71 }, freshToken()));
    expect(res.status).toBe(400);
  });

  it("400 on an invalid language_id", async () => {
    const res = await runRoute(makeReq({ source_code: "x", language_id: 999 }, freshToken()));
    expect(res.status).toBe(400);
  });

  it("400 when source code exceeds the size limit", async () => {
    const huge = "a".repeat(60 * 1024);
    const res = await runRoute(makeReq({ source_code: huge, language_id: 71 }, freshToken()));
    expect(res.status).toBe(400);
  });

  it("400 when stdin exceeds the size limit", async () => {
    const bigStdin = "a".repeat(11 * 1024);
    const res = await runRoute(makeReq({ source_code: "print(1)", language_id: 71, stdin: bigStdin }, freshToken()));
    expect(res.status).toBe(400);
  });

  it("503 when no execution engine is available", async () => {
    mAvail.mockReturnValue(false);
    const res = await runRoute(makeReq({ source_code: "print(1)", language_id: 71 }, freshToken()));
    expect(res.status).toBe(503);
  });

  it("429 once the per-user run limit (10/min) is exceeded", async () => {
    const token = freshToken();
    mExec.mockResolvedValue({
      stdout: "", stderr: "", compile_output: "", status: "accepted",
      status_description: "accepted", time: null, memory: null,
    });
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) {
      last = await runRoute(makeReq({ source_code: "print(1)", language_id: 71 }, token));
    }
    expect(last!.status).toBe(429);
  });

  it("500 when the execution engine throws", async () => {
    mExec.mockRejectedValue(new Error("engine blew up"));
    const res = await runRoute(makeReq({ source_code: "print(1)", language_id: 71 }, freshToken()));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/code/submit
// ─────────────────────────────────────────────────────────────
describe("POST /api/code/submit", () => {
  const baseBody = { exerciseId: "ex-1", source_code: "print(1)", language_id: 71, courseId: "course-1" };

  it("401 without a token", async () => {
    const res = await submitRoute(makeReq(baseBody));
    expect(res.status).toBe(401);
  });

  it("400 when required fields are missing", async () => {
    const res = await submitRoute(makeReq({ exerciseId: "ex-1" }, freshToken()));
    expect(res.status).toBe(400);
  });

  it("404 when the exercise does not exist", async () => {
    mExerciseFind.mockResolvedValue(null as never);
    const res = await submitRoute(makeReq(baseBody, freshToken()));
    expect(res.status).toBe(404);
  });

  it("403 when the user is not enrolled and the lesson is not free", async () => {
    mExerciseFind.mockResolvedValue({
      id: "ex-1", testCases: [], lesson: { isFree: false },
    } as never);
    mEnrollFind.mockResolvedValue(null as never);
    const res = await submitRoute(makeReq(baseBody, freshToken()));
    expect(res.status).toBe(403);
  });

  it("accepts a submission with zero test cases (free lesson)", async () => {
    mExerciseFind.mockResolvedValue({ id: "ex-1", testCases: [], lesson: { isFree: true } } as never);
    mSubCreate.mockResolvedValue({ id: "sub-0" } as never);
    const res = await submitRoute(makeReq(baseBody, freshToken()));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.passed).toBe(true);
    expect(body.total_tests).toBe(0);
    expect(body.submission_id).toBe("sub-0");
  });

  it("passes all test cases (enrolled user)", async () => {
    mExerciseFind.mockResolvedValue({
      id: "ex-1",
      lesson: { isFree: false },
      testCases: [
        { input: "1", expectedOutput: "1", isHidden: false, order: 0 },
        { input: "2", expectedOutput: "2", isHidden: true, order: 1 },
      ],
    } as never);
    mEnrollFind.mockResolvedValue({ userId: "u", courseId: "course-1" } as never);
    mExec
      .mockResolvedValueOnce({ stdout: "1", stderr: "", compile_output: "", status: "accepted", status_description: "accepted", time: "0.01", memory: 10 })
      .mockResolvedValueOnce({ stdout: "2", stderr: "", compile_output: "", status: "accepted", status_description: "accepted", time: "0.02", memory: 20 });
    mSubCreate.mockResolvedValue({ id: "sub-1" } as never);

    const res = await submitRoute(makeReq(baseBody, freshToken()));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.passed).toBe(true);
    expect(body.passed_tests).toBe(2);
    expect(body.total_tests).toBe(2);
    // hidden test case output must be masked
    const results = body.results as Array<Record<string, unknown>>;
    expect(results[1].expected).toBe("(hidden)");
    expect(results[1].actual).toBe("(correct)");
  });

  it("reports wrong_answer when output mismatches", async () => {
    mExerciseFind.mockResolvedValue({
      id: "ex-1", lesson: { isFree: true },
      testCases: [{ input: "1", expectedOutput: "99", isHidden: false, order: 0 }],
    } as never);
    mExec.mockResolvedValue({ stdout: "1", stderr: "", compile_output: "", status: "accepted", status_description: "accepted", time: null, memory: null });
    mSubCreate.mockResolvedValue({ id: "sub-2" } as never);

    const res = await submitRoute(makeReq(baseBody, freshToken()));
    const body = await readJson(res);
    expect(body.passed).toBe(false);
    const results = body.results as Array<Record<string, unknown>>;
    expect(results[0].status).toBe("wrong_answer");
  });

  it("short-circuits remaining test cases on a compilation error", async () => {
    mExerciseFind.mockResolvedValue({
      id: "ex-1", lesson: { isFree: true },
      testCases: [
        { input: "1", expectedOutput: "1", isHidden: false, order: 0 },
        { input: "2", expectedOutput: "2", isHidden: false, order: 1 },
      ],
    } as never);
    mExec.mockResolvedValue({ stdout: "", stderr: "", compile_output: "cannot find symbol", status: "compilation_error", status_description: "compilation error", time: null, memory: null });
    mSubCreate.mockResolvedValue({ id: "sub-3" } as never);

    const res = await submitRoute(makeReq(baseBody, freshToken()));
    const body = await readJson(res);
    expect(body.passed).toBe(false);
    // only the first test case actually ran the engine
    expect(mExec).toHaveBeenCalledTimes(1);
    const results = body.results as Array<Record<string, unknown>>;
    expect(results[1].status).toBe("compilation_error");
  });

  it("marks a test case as internal_error when the engine throws", async () => {
    mExerciseFind.mockResolvedValue({
      id: "ex-1", lesson: { isFree: true },
      testCases: [{ input: "1", expectedOutput: "1", isHidden: false, order: 0 }],
    } as never);
    mExec.mockRejectedValue(new Error("network"));
    mSubCreate.mockResolvedValue({ id: "sub-4" } as never);

    const res = await submitRoute(makeReq(baseBody, freshToken()));
    const body = await readJson(res);
    expect(body.passed).toBe(false);
    const results = body.results as Array<Record<string, unknown>>;
    expect(results[0].status).toBe("internal_error");
  });

  it("400 on an invalid language_id", async () => {
    const res = await submitRoute(makeReq({ ...baseBody, language_id: 999 }, freshToken()));
    expect(res.status).toBe(400);
  });

  it("503 when no engine is available", async () => {
    mAvail.mockReturnValue(false);
    const res = await submitRoute(makeReq(baseBody, freshToken()));
    expect(res.status).toBe(503);
  });

  it("429 once the per-user submit limit (5/min) is exceeded", async () => {
    const token = freshToken();
    mExerciseFind.mockResolvedValue({ id: "ex-1", testCases: [], lesson: { isFree: true } } as never);
    mSubCreate.mockResolvedValue({ id: "s" } as never);
    let last: Response | undefined;
    for (let i = 0; i < 6; i++) {
      last = await submitRoute(makeReq(baseBody, token));
    }
    expect(last!.status).toBe(429);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/code/compile-check
// ─────────────────────────────────────────────────────────────
describe("POST /api/code/compile-check", () => {
  it("401 without a token", async () => {
    const res = await compileRoute(makeReq({ source_code: "x", language_id: 50 }));
    expect(res.status).toBe(401);
  });

  it("returns no errors for interpreted languages (python)", async () => {
    const res = await compileRoute(makeReq({ source_code: "print(1)", language_id: 71 }, freshToken()));
    const body = await readJson(res);
    expect(body.has_errors).toBe(false);
    expect(mExec).not.toHaveBeenCalled();
  });

  it("parses a C compilation error into structured line/column", async () => {
    mExec.mockResolvedValue({
      stdout: "", stderr: "", status: "compilation_error",
      compile_output: "main.c:3:5: error: expected ';' before 'return'",
      status_description: "compilation error", time: null, memory: null,
    });
    const res = await compileRoute(makeReq({ source_code: "int main(){ return 0 }", language_id: 50 }, freshToken()));
    const body = await readJson(res);
    expect(body.has_errors).toBe(true);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].line).toBe(3);
    expect(errors[0].column).toBe(5);
    expect(errors[0].severity).toBe("error");
  });

  it("parses a Java compilation error", async () => {
    mExec.mockResolvedValue({
      stdout: "", stderr: "", status: "compilation_error",
      compile_output: "Main.java:5: error: cannot find symbol",
      status_description: "compilation error", time: null, memory: null,
    });
    const res = await compileRoute(makeReq({ source_code: "public class Main{}", language_id: 62 }, freshToken()));
    const body = await readJson(res);
    expect(body.has_errors).toBe(true);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].line).toBe(5);
  });

  it("returns no errors when code compiles cleanly", async () => {
    mExec.mockResolvedValue({
      stdout: "ok", stderr: "", compile_output: "", status: "accepted",
      status_description: "accepted", time: null, memory: null,
    });
    const res = await compileRoute(makeReq({ source_code: "int main(){return 0;}", language_id: 50 }, freshToken()));
    const body = await readJson(res);
    expect(body.has_errors).toBe(false);
  });

  it("returns no errors (soft-fail) when the engine is unavailable", async () => {
    mAvail.mockReturnValue(false);
    const res = await compileRoute(makeReq({ source_code: "int main(){}", language_id: 50 }, freshToken()));
    const body = await readJson(res);
    expect(body.has_errors).toBe(false);
  });

  it("returns no errors when source_code is empty", async () => {
    const res = await compileRoute(makeReq({ source_code: "", language_id: 50 }, freshToken()));
    const body = await readJson(res);
    expect(body.has_errors).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/code/analyze-complexity
// ─────────────────────────────────────────────────────────────
describe("POST /api/code/analyze-complexity", () => {
  it("400 when the code is too short", async () => {
    const res = await analyzeRoute(makeReq({ code: "x", language: "python" }));
    expect(res.status).toBe(400);
  });

  it("503 when Gemini is not configured", async () => {
    mGeminiCfg.mockReturnValue(false);
    const res = await analyzeRoute(makeReq({ code: "for i in range(10): print(i)", language: "python" }));
    expect(res.status).toBe(503);
  });

  it("returns time & space complexity on success", async () => {
    mGeminiJSON.mockResolvedValue({ timeComplexity: "O(n)", spaceComplexity: "O(1)" } as never);
    const res = await analyzeRoute(makeReq({ code: "for i in range(n): print(i)", language: "python" }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.timeComplexity).toBe("O(n)");
    expect(body.spaceComplexity).toBe("O(1)");
  });

  it("503 when the AI returns an incomplete result", async () => {
    mGeminiJSON.mockResolvedValue(null as never);
    const res = await analyzeRoute(makeReq({ code: "for i in range(n): print(i)", language: "python" }));
    expect(res.status).toBe(503);
  });

  it("500 when the AI call throws", async () => {
    mGeminiJSON.mockRejectedValue(new Error("ai down"));
    const res = await analyzeRoute(makeReq({ code: "for i in range(n): print(i)", language: "python" }));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/code/autocomplete
// ─────────────────────────────────────────────────────────────
describe("POST /api/code/autocomplete", () => {
  it("returns an empty suggestion for very short code", async () => {
    const res = await autocompleteRoute(makeReq({ code: "x", language: "python" }));
    const body = await readJson(res);
    expect(body.suggestion).toBe("");
  });

  it("returns an empty suggestion when Gemini is not configured", async () => {
    mGeminiCfg.mockReturnValue(false);
    const res = await autocompleteRoute(makeReq({ code: "def solve(n):", language: "python" }));
    const body = await readJson(res);
    expect(body.suggestion).toBe("");
  });

  it("returns a cleaned suggestion stripped of markdown fences", async () => {
    mGemini.mockResolvedValue("```python\n    return n * 2\n```");
    const res = await autocompleteRoute(makeReq({ code: "def solve(n):", language: "python", cursorLine: 1 }));
    const body = await readJson(res);
    expect(body.suggestion).toContain("return n * 2");
    expect(body.suggestion).not.toContain("```");
  });

  it("caps the suggestion at 15 lines", async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
    mGemini.mockResolvedValue(twenty);
    const res = await autocompleteRoute(makeReq({ code: "def solve(n):", language: "python" }));
    const body = await readJson(res);
    expect((body.suggestion as string).split("\n").length).toBeLessThanOrEqual(15);
  });

  it("returns an empty suggestion (never throws) when the AI call fails", async () => {
    mGemini.mockRejectedValue(new Error("ai down"));
    const res = await autocompleteRoute(makeReq({ code: "def solve(n):", language: "python" }));
    const body = await readJson(res);
    expect(body.suggestion).toBe("");
  });

  it("includes problem context in the prompt when provided", async () => {
    mGemini.mockResolvedValue("ok");
    await autocompleteRoute(makeReq({
      code: "def two_sum(nums, target):",
      language: "python",
      problemTitle: "Two Sum",
      problemDesc: "Find two numbers that add up to target.",
    }));
    const prompt = mGemini.mock.calls[0][0] as string;
    expect(prompt).toContain("Two Sum");
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/code/submissions
// ─────────────────────────────────────────────────────────────
describe("GET /api/code/submissions", () => {
  it("401 without a token", async () => {
    const res = await submissionsRoute(makeReq({}, undefined, { exerciseId: "ex-1" }));
    expect(res.status).toBe(401);
  });

  it("400 when exerciseId is missing", async () => {
    const res = await submissionsRoute(makeReq({}, freshToken(), {}));
    expect(res.status).toBe(400);
  });

  it("returns the user's submission history", async () => {
    mSubFindMany.mockResolvedValue([
      { id: "s1", language: "python", passed: true, status: "accepted", executionTime: 10, memoryUsed: 100, createdAt: new Date() },
    ] as never);
    const res = await submissionsRoute(makeReq({}, freshToken(), { exerciseId: "ex-1" }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.submissions as unknown[]).length).toBe(1);
  });

  it("500 when the DB query fails (non-auth error)", async () => {
    mSubFindMany.mockRejectedValue(new Error("db exploded"));
    const res = await submissionsRoute(makeReq({}, freshToken(), { exerciseId: "ex-1" }));
    expect(res.status).toBe(500);
  });
});
