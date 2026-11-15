/**
 * Unit tests — more content routes (Phase 8, batch C)
 *   • POST/GET /api/enroll-token   (generate + verify/consume one-time token)
 *   • GET/POST /api/exercise       (list + AI-evaluated submission)
 *   • POST /api/lesson-help        (guard/cache/404 branches)
 *
 * FULLY MOCKED — prisma, gemini, rag, tts, sync-student and logger are mocked.
 * Auth is REAL (test-only JWT). No real DB / AI / network is touched.
 */

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-only-jwt-secret-value-0123456789-abcdef";
}

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    course: { findUnique: jest.fn() },
    enrollToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    enrollment: { upsert: jest.fn() },
    exercise: { findMany: jest.fn(), findUnique: jest.fn() },
    exerciseSubmission: { create: jest.fn() },
    quiz: { findUnique: jest.fn() },
    lessonHelpCache: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

jest.mock("@/app/lib/gemini", () => ({
  callGemini: jest.fn(),
  callGeminiStream: jest.fn(),
  callGeminiJSON: jest.fn(),
  isGeminiConfigured: jest.fn(() => true),
}));
jest.mock("@/app/lib/rag", () => ({
  searchChunks: jest.fn().mockResolvedValue([]),
  resolveSources: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/app/api/tts/route", () => ({
  synthesizeSpeech: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/app/lib/sync-student", () => ({
  syncStudentOnEnroll: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { POST as enrollCreate, GET as enrollVerify } from "@/app/api/enroll-token/route";
import { GET as exerciseList, POST as exerciseSubmit } from "@/app/api/exercise/route";
import { POST as lessonHelp } from "@/app/api/lesson-help/route";

import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { callGeminiJSON, isGeminiConfigured } from "@/app/lib/gemini";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";

const mCourseFind = prisma.course.findUnique as jest.MockedFunction<typeof prisma.course.findUnique>;
const mTokenCreate = prisma.enrollToken.create as jest.MockedFunction<typeof prisma.enrollToken.create>;
const mTokenFind = prisma.enrollToken.findUnique as jest.MockedFunction<typeof prisma.enrollToken.findUnique>;
const mTokenUpdate = prisma.enrollToken.update as jest.MockedFunction<typeof prisma.enrollToken.update>;
const mEnrollUpsert = prisma.enrollment.upsert as jest.MockedFunction<typeof prisma.enrollment.upsert>;
const mExerciseFindMany = prisma.exercise.findMany as jest.MockedFunction<typeof prisma.exercise.findMany>;
const mExerciseFind = prisma.exercise.findUnique as jest.MockedFunction<typeof prisma.exercise.findUnique>;
const mSubCreate = prisma.exerciseSubmission.create as jest.MockedFunction<typeof prisma.exerciseSubmission.create>;
const mQuizFind = prisma.quiz.findUnique as jest.MockedFunction<typeof prisma.quiz.findUnique>;
const mCacheFind = prisma.lessonHelpCache.findUnique as jest.MockedFunction<typeof prisma.lessonHelpCache.findUnique>;
const mGeminiJSON = callGeminiJSON as jest.MockedFunction<typeof callGeminiJSON>;
const mGeminiCfg = isGeminiConfigured as jest.MockedFunction<typeof isGeminiConfigured>;
const mSync = syncStudentOnEnroll as jest.MockedFunction<typeof syncStudentOnEnroll>;

const USER = signToken({ userId: "user-1", email: "u@test.com", role: "user" });

function makeReq(opts: { token?: string; body?: unknown; query?: Record<string, string> } = {}) {
  const headers = new Map<string, string>();
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  const params = new URLSearchParams(opts.query || {});
  return {
    json: async () => opts.body ?? {},
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    nextUrl: { searchParams: params },
  } as never;
}
async function readJson(res: Response) {
  return (res as unknown as { json: () => Promise<Record<string, unknown>> }).json();
}

beforeEach(() => {
  mGeminiCfg.mockReturnValue(true);
  mSync.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────
// enroll-token
// ─────────────────────────────────────────────────────────────
describe("POST /api/enroll-token", () => {
  it("401 without a token", async () => {
    const res = await enrollCreate(makeReq({ body: { courseId: "c1" } }));
    expect(res.status).toBe(401);
  });

  it("400 when courseId is missing", async () => {
    const res = await enrollCreate(makeReq({ token: USER, body: {} }));
    expect(res.status).toBe(400);
  });

  it("404 when the course does not exist", async () => {
    mCourseFind.mockResolvedValue(null as never);
    const res = await enrollCreate(makeReq({ token: USER, body: { courseId: "c1" } }));
    expect(res.status).toBe(404);
  });

  it("generates a one-time enroll token", async () => {
    mCourseFind.mockResolvedValue({ id: "c1" } as never);
    mTokenCreate.mockResolvedValue({ token: "tok" } as never);
    const res = await enrollCreate(makeReq({ token: USER, body: { courseId: "c1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(typeof body.enrollToken).toBe("string");
    expect((body.enrollToken as string).length).toBeGreaterThan(10);
  });
});

describe("GET /api/enroll-token (verify/consume)", () => {
  it("400 when token query is missing", async () => {
    const res = await enrollVerify(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("400 for an invalid token", async () => {
    mTokenFind.mockResolvedValue(null as never);
    const res = await enrollVerify(makeReq({ query: { token: "bad" } }));
    expect(res.status).toBe(400);
  });

  it("400 when the token is already used", async () => {
    mTokenFind.mockResolvedValue({ used: true, expiresAt: new Date(Date.now() + 1e6) } as never);
    const res = await enrollVerify(makeReq({ query: { token: "t" } }));
    expect(res.status).toBe(400);
  });

  it("400 when the token is expired", async () => {
    mTokenFind.mockResolvedValue({ used: false, expiresAt: new Date(Date.now() - 1000) } as never);
    const res = await enrollVerify(makeReq({ query: { token: "t" } }));
    expect(res.status).toBe(400);
  });

  it("consumes the token and enrolls the user", async () => {
    mTokenFind.mockResolvedValue({
      used: false, expiresAt: new Date(Date.now() + 1e6), userId: "user-1", courseId: "c1",
    } as never);
    mTokenUpdate.mockResolvedValue({} as never);
    mEnrollUpsert.mockResolvedValue({} as never);
    const res = await enrollVerify(makeReq({ query: { token: "t" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.courseId).toBe("c1");
    expect(mTokenUpdate).toHaveBeenCalledWith({ where: { token: "t" }, data: { used: true } });
    expect(mSync).toHaveBeenCalledWith("user-1");
  });
});

// ─────────────────────────────────────────────────────────────
// exercise
// ─────────────────────────────────────────────────────────────
describe("GET /api/exercise", () => {
  it("400 when lessonId is missing", async () => {
    const res = await exerciseList(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("lists exercises for a lesson", async () => {
    mExerciseFindMany.mockResolvedValue([{ id: "e1", title: "Sum" }] as never);
    const res = await exerciseList(makeReq({ query: { lessonId: "l1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.exercises as unknown[]).length).toBe(1);
  });
});

describe("POST /api/exercise (submit)", () => {
  it("401 without a token", async () => {
    const res = await exerciseSubmit(makeReq({ body: { exerciseId: "e1", code: "x", courseId: "c1" } }));
    expect(res.status).toBe(401);
  });

  it("400 when required fields are missing", async () => {
    const res = await exerciseSubmit(makeReq({ token: USER, body: { exerciseId: "e1" } }));
    expect(res.status).toBe(400);
  });

  it("404 when the exercise does not exist", async () => {
    mExerciseFind.mockResolvedValue(null as never);
    const res = await exerciseSubmit(makeReq({ token: USER, body: { exerciseId: "e1", code: "print(1)", courseId: "c1" } }));
    expect(res.status).toBe(404);
  });

  it("evaluates via Gemini and saves the submission (passed)", async () => {
    mExerciseFind.mockResolvedValue({ id: "e1", title: "Sum", description: "add", solution: "a+b" } as never);
    mGeminiJSON.mockResolvedValue({ passed: true, feedback: "Great job" } as never);
    mSubCreate.mockResolvedValue({ id: "sub1" } as never);
    const res = await exerciseSubmit(makeReq({ token: USER, body: { exerciseId: "e1", code: "return a+b", courseId: "c1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.passed).toBe(true);
    expect(body.submissionId).toBe("sub1");
  });

  it("falls back to a length heuristic when Gemini is off", async () => {
    mGeminiCfg.mockReturnValue(false);
    mExerciseFind.mockResolvedValue({ id: "e1", description: "add" } as never);
    mSubCreate.mockResolvedValue({ id: "sub2" } as never);
    const res = await exerciseSubmit(makeReq({ token: USER, body: { exerciseId: "e1", code: "return a+b;", courseId: "c1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.passed).toBe(true); // length >= 10
  });
});

// ─────────────────────────────────────────────────────────────
// lesson-help — guard / cache / 404 branches
// ─────────────────────────────────────────────────────────────
describe("POST /api/lesson-help", () => {
  it("401 without a token", async () => {
    const res = await lessonHelp(makeReq({ body: { kind: "quiz", quizId: "q1" } }));
    expect(res.status).toBe(401);
  });

  it("503 when Gemini is not configured", async () => {
    mGeminiCfg.mockReturnValue(false);
    const res = await lessonHelp(makeReq({ token: USER, body: { kind: "quiz", quizId: "q1" } }));
    expect(res.status).toBe(503);
  });

  it("400 for an invalid kind", async () => {
    const res = await lessonHelp(makeReq({ token: USER, body: { kind: "bogus" } }));
    expect(res.status).toBe(400);
  });

  it("400 when the item id is missing", async () => {
    const res = await lessonHelp(makeReq({ token: USER, body: { kind: "quiz" } }));
    expect(res.status).toBe(400);
  });

  it("serves a cached entry instantly (JSON)", async () => {
    mCacheFind.mockResolvedValue({
      helpText: "The answer is option C.",
      audioBase64: null, voice: null, source: "ai", sources: [],
    } as never);
    const res = await lessonHelp(makeReq({ token: USER, body: { kind: "quiz", quizId: "q1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.help).toContain("option C");
  });

  it("404 when the quiz is not found (no cache hit)", async () => {
    mCacheFind.mockResolvedValue(null as never);
    mQuizFind.mockResolvedValue(null as never);
    const res = await lessonHelp(makeReq({ token: USER, body: { kind: "quiz", quizId: "q1" } }));
    expect(res.status).toBe(404);
  });
});
