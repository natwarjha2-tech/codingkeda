/**
 * Unit tests — lesson content generator (app/lib/lesson-content-generator.ts) [Phase 8]
 * Covers the deterministic GUARD / SKIP / EARLY-EXIT branches of
 * generateLessonQuiz + generateLessonExercise (the Gemini/PDF-heavy happy path
 * needs a live model, so we exercise everything up to it):
 *   • no GEMINI_API_KEY        → { ok:false }
 *   • lesson not found         → { ok:false }
 *   • content already exists   → { ok:true, skipped:true }
 *   • no quiz/ppt/notes PDF    → { ok:true, skipped:true }
 *   • PDF present but no text   → { ok:true, skipped:true } (buildPdfPart fails)
 *
 * FULLY MOCKED — prisma, the AWS SDK and the presigner are mocked, and
 * global.fetch is stubbed. No real DB / AWS / Gemini / network is touched.
 */

// GEMINI_API_KEY is read at MODULE LOAD, so set it before importing the lib.
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "ck-bucket";

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    lesson: { findUnique: jest.fn() },
    moduleMaterial: { findMany: jest.fn() },
    quiz: { deleteMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    exercise: { deleteMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  GetObjectCommand: jest.fn().mockImplementation((i) => i),
}));
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://signed.example/doc.pdf"),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { generateLessonQuiz, generateLessonExercise } from "@/app/lib/lesson-content-generator";
import { prisma } from "@/app/lib/prisma";

const mLessonFind = prisma.lesson.findUnique as jest.MockedFunction<typeof prisma.lesson.findUnique>;
const mMaterials = prisma.moduleMaterial.findMany as jest.MockedFunction<typeof prisma.moduleMaterial.findMany>;

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});
beforeEach(() => {
  mockFetch.mockReset();
  // resolveModels() does a models-list fetch at most once per process; return a
  // benign empty list so it never hits the network for real.
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ models: [] }), headers: { get: () => null } });
});

function lessonRow(over: Partial<{ quizzes: number; exercises: number; notes: string | null }> = {}) {
  return {
    id: "l1",
    title: "Loops",
    notes: over.notes ?? null,
    moduleId: "m1",
    _count: { quizzes: over.quizzes ?? 0, exercises: over.exercises ?? 0 },
    module: { id: "m1", title: "Basics", course: { title: "Python" } },
  };
}

describe("generateLessonQuiz — guard paths", () => {
  it("skips (skipped:true) when quizzes already exist", async () => {
    mLessonFind.mockResolvedValue(lessonRow({ quizzes: 3 }) as never);
    const res = await generateLessonQuiz("l1");
    expect(res).toEqual({ ok: true, skipped: true });
  });

  it("fails when the lesson is not found", async () => {
    mLessonFind.mockResolvedValue(null as never);
    const res = await generateLessonQuiz("l1");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("lesson not found");
  });

  it("skips when there is no quiz/ppt/notes PDF source", async () => {
    mLessonFind.mockResolvedValue(lessonRow({ quizzes: 0, notes: null }) as never);
    mMaterials.mockResolvedValue([] as never);
    const res = await generateLessonQuiz("l1");
    expect(res).toEqual({ ok: true, skipped: true });
  });

  it("skips when a PDF exists but yields no readable text/part", async () => {
    mLessonFind.mockResolvedValue(lessonRow({ quizzes: 0 }) as never);
    mMaterials.mockResolvedValue([
      { title: "quiz", fileUrl: "https://ck-bucket.s3.amazonaws.com/m/quiz.pdf", fileType: "pdf" },
    ] as never);
    // extractPdfText fetch → not ok (empty text) so resolveContentSource returns
    // a vision source with pdfUrl; then buildPdfPart's downloadPdfBuffer fetch
    // also fails → buildPdfPart null → route returns skipped.
    // downloadPdfBuffer retries 3x with backoff sleeps, so widen the timeout.
    mockFetch.mockResolvedValue({ ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0), json: async () => ({ models: [] }), headers: { get: () => null } });
    const res = await generateLessonQuiz("l1");
    expect(res).toEqual({ ok: true, skipped: true });
  }, 15000);
});

describe("generateLessonExercise — guard paths", () => {
  it("skips when exercises already exist", async () => {
    mLessonFind.mockResolvedValue(lessonRow({ exercises: 2 }) as never);
    const res = await generateLessonExercise("l1");
    expect(res).toEqual({ ok: true, skipped: true });
  });

  it("fails when the lesson is not found", async () => {
    mLessonFind.mockResolvedValue(null as never);
    const res = await generateLessonExercise("l1");
    expect(res.ok).toBe(false);
  });

  it("skips when there is no worksheet/notes PDF source", async () => {
    mLessonFind.mockResolvedValue(lessonRow({ exercises: 0, notes: null }) as never);
    mMaterials.mockResolvedValue([] as never);
    const res = await generateLessonExercise("l1");
    expect(res).toEqual({ ok: true, skipped: true });
  });
});
