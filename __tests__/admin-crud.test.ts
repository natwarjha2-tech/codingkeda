/**
 * Unit tests — Admin CRUD API routes (Phase 5)
 *   • DELETE /api/admin/courses/[id]
 *   • GET    /api/admin/courses/all        (super-admin)
 *   • PATCH/DELETE /api/admin/modules/[id]
 *   • PATCH/DELETE /api/admin/lessons/[id]
 *   • GET/POST     /api/admin/exercises
 *   • PUT/DELETE   /api/admin/exercises/[id]
 *   • GET/POST     /api/admin/quiz
 *   • PUT/DELETE   /api/admin/quiz/[id]
 *   • POST         /api/admin/homework
 *
 * FULLY MOCKED — prisma, S3 helpers, notification and logger are all mocked.
 * Auth is REAL (we sign valid admin / super-admin JWTs with a test-only secret)
 * so requireAdmin/requireSuperAdmin are genuinely exercised. global.fetch is
 * stubbed for the exercises fire-and-forget solution trigger. No real DB /
 * AWS / network is ever touched — zero production side effects.
 */

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-only-jwt-secret-value-0123456789-abcdef";
}

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    course: { findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    user: { findMany: jest.fn() },
    module: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    lesson: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    media: { findFirst: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    weeklyStreak: { deleteMany: jest.fn() },
    achievement: { deleteMany: jest.fn() },
    coinTransaction: { deleteMany: jest.fn() },
    enrollToken: { deleteMany: jest.fn() },
    enrollment: { findMany: jest.fn() },
    exercise: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    testCase: { deleteMany: jest.fn() },
    quiz: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    homework: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock("@/app/lib/s3", () => ({
  deleteS3Prefix: jest.fn().mockResolvedValue(true),
  deleteFromS3: jest.fn().mockResolvedValue(true),
  getS3KeyFromUrl: jest.fn((url: string) => (url ? "key/" + url.split("/").pop() : null)),
  deleteQualitiesByMediaId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/lib/notification", () => ({
  notifyNewHomework: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { DELETE as deleteCourse } from "@/app/api/admin/courses/[id]/route";
import { GET as getAllCourses } from "@/app/api/admin/courses/all/route";
import { PATCH as patchModule, DELETE as deleteModule } from "@/app/api/admin/modules/[id]/route";
import { PATCH as patchLesson, DELETE as deleteLesson } from "@/app/api/admin/lessons/[id]/route";
import { GET as getExercises, POST as createExercise } from "@/app/api/admin/exercises/route";
import { PUT as putExercise, DELETE as deleteExercise } from "@/app/api/admin/exercises/[id]/route";
import { GET as getQuiz, POST as createQuiz } from "@/app/api/admin/quiz/route";
import { PUT as putQuiz, DELETE as deleteQuiz } from "@/app/api/admin/quiz/[id]/route";
import { POST as createHomework } from "@/app/api/admin/homework/route";

import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { notifyNewHomework } from "@/app/lib/notification";
import { deleteFromS3, deleteS3Prefix, getS3KeyFromUrl, deleteQualitiesByMediaId } from "@/app/lib/s3";

// Typed mock helpers
const mCourseFind = prisma.course.findUnique as jest.MockedFunction<typeof prisma.course.findUnique>;
const mCourseFindMany = prisma.course.findMany as jest.MockedFunction<typeof prisma.course.findMany>;
const mCourseDelete = prisma.course.delete as jest.MockedFunction<typeof prisma.course.delete>;
const mUserFindMany = prisma.user.findMany as jest.MockedFunction<typeof prisma.user.findMany>;
const mModuleFind = prisma.module.findUnique as jest.MockedFunction<typeof prisma.module.findUnique>;
const mModuleUpdate = prisma.module.update as jest.MockedFunction<typeof prisma.module.update>;
const mModuleDelete = prisma.module.delete as jest.MockedFunction<typeof prisma.module.delete>;
const mLessonFind = prisma.lesson.findUnique as jest.MockedFunction<typeof prisma.lesson.findUnique>;
const mLessonFindMany = prisma.lesson.findMany as jest.MockedFunction<typeof prisma.lesson.findMany>;
const mLessonUpdate = prisma.lesson.update as jest.MockedFunction<typeof prisma.lesson.update>;
const mLessonDelete = prisma.lesson.delete as jest.MockedFunction<typeof prisma.lesson.delete>;
const mMediaFindFirst = prisma.media.findFirst as jest.MockedFunction<typeof prisma.media.findFirst>;
const mMediaFindMany = prisma.media.findMany as jest.MockedFunction<typeof prisma.media.findMany>;
const mExerciseFindMany = prisma.exercise.findMany as jest.MockedFunction<typeof prisma.exercise.findMany>;
const mExerciseCreate = prisma.exercise.create as jest.MockedFunction<typeof prisma.exercise.create>;
const mExerciseUpdate = prisma.exercise.update as jest.MockedFunction<typeof prisma.exercise.update>;
const mExerciseDelete = prisma.exercise.delete as jest.MockedFunction<typeof prisma.exercise.delete>;
const mQuizFindMany = prisma.quiz.findMany as jest.MockedFunction<typeof prisma.quiz.findMany>;
const mQuizCreate = prisma.quiz.create as jest.MockedFunction<typeof prisma.quiz.create>;
const mQuizUpdate = prisma.quiz.update as jest.MockedFunction<typeof prisma.quiz.update>;
const mQuizDelete = prisma.quiz.delete as jest.MockedFunction<typeof prisma.quiz.delete>;
const mHomeworkFindFirst = prisma.homework.findFirst as jest.MockedFunction<typeof prisma.homework.findFirst>;
const mHomeworkCreate = prisma.homework.create as jest.MockedFunction<typeof prisma.homework.create>;
const mEnrollmentFindMany = prisma.enrollment.findMany as jest.MockedFunction<typeof prisma.enrollment.findMany>;
const mNotifyHomework = notifyNewHomework as jest.MockedFunction<typeof notifyNewHomework>;
const mDeleteFromS3 = deleteFromS3 as jest.MockedFunction<typeof deleteFromS3>;
const mDeleteS3Prefix = deleteS3Prefix as jest.MockedFunction<typeof deleteS3Prefix>;
const mGetS3Key = getS3KeyFromUrl as jest.MockedFunction<typeof getS3KeyFromUrl>;
const mDeleteQualities = deleteQualitiesByMediaId as jest.MockedFunction<typeof deleteQualitiesByMediaId>;

const ADMIN = signToken({ userId: "admin-1", email: "admin@test.com", role: "admin" });
const SUPER = signToken({ userId: "super-1", email: "super@test.com", role: "super-admin" });
const STUDENT = signToken({ userId: "stud-1", email: "stud@test.com", role: "user" });

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
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function readJson(res: Response) {
  return (res as unknown as { json: () => Promise<Record<string, unknown>> }).json();
}

beforeEach(() => {
  // fire-and-forget solution generator in exercises POST calls fetch — stub it
  // fresh each test (resetMocks wipes it otherwise).
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
  // Re-arm S3 mocks — jest.config has resetMocks:true which WIPES factory
  // implementations/resolved values before every test, so re-establish them here.
  mDeleteFromS3.mockResolvedValue(true);
  mDeleteS3Prefix.mockResolvedValue(true);
  mDeleteQualities.mockResolvedValue(undefined);
  mGetS3Key.mockImplementation((url: string) => (url ? "key/" + url.split("/").pop() : null));
  mNotifyHomework.mockResolvedValue(undefined as never);
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/courses/[id]
// ─────────────────────────────────────────────────────────────
describe("DELETE /api/admin/courses/[id]", () => {
  it("401 without a token", async () => {
    const res = await deleteCourse(makeReq({}), ctx("c1"));
    expect(res.status).toBe(401);
  });

  it("403 for a non-admin user", async () => {
    const res = await deleteCourse(makeReq({ token: STUDENT }), ctx("c1"));
    expect(res.status).toBe(403);
  });

  it("404 when the course does not exist", async () => {
    mCourseFind.mockResolvedValue(null as never);
    const res = await deleteCourse(makeReq({ token: ADMIN }), ctx("c1"));
    expect(res.status).toBe(404);
  });

  it("403 when an admin tries to delete someone else's course", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", createdBy: "other-admin" } as never);
    const res = await deleteCourse(makeReq({ token: ADMIN }), ctx("c1"));
    expect(res.status).toBe(403);
  });

  it("deletes the course + all reference data on the happy path", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", createdBy: "admin-1" } as never);
    mLessonFindMany.mockResolvedValue([
      { id: "l1", videoUrl: "https://cdn/v1.mp4", notes: "https://cdn/n1.pdf" },
    ] as never);
    mMediaFindFirst.mockResolvedValue({ id: "m1", hlsS3Prefix: "hls/pre" } as never);
    mMediaFindMany.mockResolvedValue([] as never); // no orphaned media
    mCourseDelete.mockResolvedValue({ id: "c1" } as never);

    const res = await deleteCourse(makeReq({ token: ADMIN }), ctx("c1"));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(mCourseDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(mDeleteFromS3).toHaveBeenCalled(); // video + pdf
    expect(body.message).toContain("1 lessons");
  });

  it("super-admin can delete any admin's course", async () => {
    mCourseFind.mockResolvedValue({ id: "c1", createdBy: "someone-else" } as never);
    mLessonFindMany.mockResolvedValue([] as never);
    mMediaFindMany.mockResolvedValue([] as never);
    mCourseDelete.mockResolvedValue({ id: "c1" } as never);

    const res = await deleteCourse(makeReq({ token: SUPER }), ctx("c1"));
    expect(res.status).toBe(200);
  });

  it("500 when the DB throws", async () => {
    mCourseFind.mockRejectedValue(new Error("db down"));
    const res = await deleteCourse(makeReq({ token: ADMIN }), ctx("c1"));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/courses/all  (super-admin only)
// ─────────────────────────────────────────────────────────────
describe("GET /api/admin/courses/all", () => {
  it("403 for a plain admin (super-admin required)", async () => {
    const res = await getAllCourses(makeReq({ token: ADMIN }));
    expect(res.status).toBe(403);
  });

  it("returns all courses with creator details for a super-admin", async () => {
    mCourseFindMany.mockResolvedValue([
      { id: "c1", title: "A", createdBy: "admin-1", _count: { modules: 2, enrollments: 5 } },
      { id: "c2", title: "B", createdBy: null, _count: { modules: 0, enrollments: 0 } },
    ] as never);
    mUserFindMany.mockResolvedValue([
      { id: "admin-1", name: "Admin One", email: "a@test.com", role: "admin" },
    ] as never);

    const res = await getAllCourses(makeReq({ token: SUPER }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    const courses = body.courses as Array<Record<string, unknown>>;
    expect((courses[0].creator as Record<string, unknown>).name).toBe("Admin One");
    expect(courses[1].creator).toBeNull();
  });

  it("500 when the DB throws", async () => {
    mCourseFindMany.mockRejectedValue(new Error("db down"));
    const res = await getAllCourses(makeReq({ token: SUPER }));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH / DELETE /api/admin/modules/[id]
// ─────────────────────────────────────────────────────────────
describe("PATCH /api/admin/modules/[id]", () => {
  it("401 without a token", async () => {
    const res = await patchModule(makeReq({ body: { title: "x" } }), ctx("m1"));
    expect(res.status).toBe(401);
  });

  it("400 when the title is blank", async () => {
    const res = await patchModule(makeReq({ token: ADMIN, body: { title: "  " } }), ctx("m1"));
    expect(res.status).toBe(400);
  });

  it("404 when the module does not exist", async () => {
    mModuleFind.mockResolvedValue(null as never);
    const res = await patchModule(makeReq({ token: ADMIN, body: { title: "New" } }), ctx("m1"));
    expect(res.status).toBe(404);
  });

  it("renames the module on the happy path (title trimmed)", async () => {
    mModuleFind.mockResolvedValue({ id: "m1", title: "Old" } as never);
    mModuleUpdate.mockResolvedValue({ id: "m1", title: "New" } as never);
    const res = await patchModule(makeReq({ token: ADMIN, body: { title: "  New  " } }), ctx("m1"));
    expect(res.status).toBe(200);
    expect(mModuleUpdate).toHaveBeenCalledWith({ where: { id: "m1" }, data: { title: "New" } });
  });
});

describe("DELETE /api/admin/modules/[id]", () => {
  it("403 for a non-admin", async () => {
    const res = await deleteModule(makeReq({ token: STUDENT }), ctx("m1"));
    expect(res.status).toBe(403);
  });

  it("404 when the module does not exist", async () => {
    mModuleFind.mockResolvedValue(null as never);
    const res = await deleteModule(makeReq({ token: ADMIN }), ctx("m1"));
    expect(res.status).toBe(404);
  });

  it("deletes the module + its lessons' S3 assets", async () => {
    mModuleFind.mockResolvedValue({ id: "m1" } as never);
    mLessonFindMany.mockResolvedValue([
      { id: "l1", videoUrl: "https://cdn/v.mp4", notes: null },
    ] as never);
    mMediaFindFirst.mockResolvedValue({ id: "md1", hlsS3Prefix: null } as never);
    mMediaFindMany.mockResolvedValue([] as never);
    mModuleDelete.mockResolvedValue({ id: "m1" } as never);

    const res = await deleteModule(makeReq({ token: ADMIN }), ctx("m1"));
    expect(res.status).toBe(200);
    expect(mModuleDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH / DELETE /api/admin/lessons/[id]
// ─────────────────────────────────────────────────────────────
describe("PATCH /api/admin/lessons/[id]", () => {
  it("401 without a token", async () => {
    const res = await patchLesson(makeReq({ body: { title: "x" } }), ctx("l1"));
    expect(res.status).toBe(401);
  });

  it("400 when no valid fields are provided", async () => {
    const res = await patchLesson(makeReq({ token: ADMIN, body: { bogus: 1 } }), ctx("l1"));
    expect(res.status).toBe(400);
  });

  it("400 when the title is provided but empty", async () => {
    const res = await patchLesson(makeReq({ token: ADMIN, body: { title: "   " } }), ctx("l1"));
    expect(res.status).toBe(400);
  });

  it("updates allowed fields only (ignores unknown keys)", async () => {
    mLessonUpdate.mockResolvedValue({ id: "l1" } as never);
    const res = await patchLesson(
      makeReq({ token: ADMIN, body: { title: "  T  ", quizPdfUrl: "u", hacker: "x" } }),
      ctx("l1")
    );
    expect(res.status).toBe(200);
    const arg = mLessonUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.title).toBe("T");
    expect(arg.data.quizPdfUrl).toBe("u");
    expect(arg.data).not.toHaveProperty("hacker");
  });
});

describe("DELETE /api/admin/lessons/[id]", () => {
  it("404 when the lesson does not exist", async () => {
    mLessonFind.mockResolvedValue(null as never);
    const res = await deleteLesson(makeReq({ token: ADMIN }), ctx("l1"));
    expect(res.status).toBe(404);
  });

  it("deletes the lesson + S3 video/pdf + media records", async () => {
    mLessonFind.mockResolvedValue({ id: "l1", videoUrl: "https://cdn/v.mp4", notes: "https://cdn/n.pdf" } as never);
    mMediaFindFirst.mockResolvedValue({ id: "md1", hlsS3Prefix: "hls/x" } as never);
    mMediaFindMany.mockResolvedValue([] as never);
    mLessonDelete.mockResolvedValue({ id: "l1" } as never);

    const res = await deleteLesson(makeReq({ token: ADMIN }), ctx("l1"));
    expect(res.status).toBe(200);
    expect(mLessonDelete).toHaveBeenCalledWith({ where: { id: "l1" } });
    expect(mDeleteFromS3).toHaveBeenCalled();
  });

  it("cleans up genuinely orphaned inactive media (>1h old)", async () => {
    mLessonFind.mockResolvedValue({ id: "l1", videoUrl: null, notes: null } as never);
    mMediaFindMany.mockResolvedValue([{ id: "orphan", s3Key: "k/orphan" }] as never);
    mLessonDelete.mockResolvedValue({ id: "l1" } as never);

    const res = await deleteLesson(makeReq({ token: ADMIN }), ctx("l1"));
    expect(res.status).toBe(200);
    expect(mDeleteFromS3).toHaveBeenCalledWith("k/orphan");
  });
});

// ─────────────────────────────────────────────────────────────
// GET / POST /api/admin/exercises
// ─────────────────────────────────────────────────────────────
describe("GET /api/admin/exercises", () => {
  it("403 for a non-admin", async () => {
    const res = await getExercises(makeReq({ token: STUDENT, query: { lessonId: "l1" } }));
    expect(res.status).toBe(403);
  });

  it("400 when lessonId is missing", async () => {
    const res = await getExercises(makeReq({ token: ADMIN }));
    expect(res.status).toBe(400);
  });

  it("lists exercises for a lesson", async () => {
    mExerciseFindMany.mockResolvedValue([{ id: "e1", testCases: [] }] as never);
    const res = await getExercises(makeReq({ token: ADMIN, query: { lessonId: "l1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.exercises as unknown[]).length).toBe(1);
  });
});

describe("POST /api/admin/exercises", () => {
  it("400 when required fields are missing", async () => {
    const res = await createExercise(makeReq({ token: ADMIN, body: { title: "t" } }));
    expect(res.status).toBe(400);
  });

  it("creates a theory exercise (no solution trigger)", async () => {
    mExerciseCreate.mockResolvedValue({ id: "e1", type: "theory" } as never);
    const res = await createExercise(makeReq({
      token: ADMIN,
      body: { lessonId: "l1", title: "T", description: "D", type: "theory" },
    }));
    expect(res.status).toBe(200);
    const arg = mExerciseCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.language).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("creates a coding exercise and triggers solution generation", async () => {
    mExerciseCreate.mockResolvedValue({ id: "e2", type: "coding" } as never);
    const res = await createExercise(makeReq({
      token: ADMIN,
      body: { lessonId: "l1", title: "T", description: "D", type: "coding" },
    }));
    expect(res.status).toBe(200);
    const arg = mExerciseCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.language).toBe("c"); // default language for coding
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe("PUT / DELETE /api/admin/exercises/[id]", () => {
  it("updates only the provided fields", async () => {
    mExerciseUpdate.mockResolvedValue({ id: "e1", title: "New" } as never);
    const res = await putExercise(makeReq({ token: ADMIN, body: { title: "New" } }), ctx("e1"));
    expect(res.status).toBe(200);
    const arg = mExerciseUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data).toEqual({ title: "New" });
  });

  it("deletes the exercise + its test cases", async () => {
    (prisma.testCase.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
    mExerciseDelete.mockResolvedValue({ id: "e1" } as never);
    const res = await deleteExercise(makeReq({ token: ADMIN }), ctx("e1"));
    expect(res.status).toBe(200);
    expect(prisma.testCase.deleteMany).toHaveBeenCalledWith({ where: { exerciseId: "e1" } });
    expect(mExerciseDelete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });

  it("500 when the update throws", async () => {
    mExerciseUpdate.mockRejectedValue(new Error("db down"));
    const res = await putExercise(makeReq({ token: ADMIN, body: { title: "x" } }), ctx("e1"));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// GET / POST /api/admin/quiz  +  PUT/DELETE /api/admin/quiz/[id]
// ─────────────────────────────────────────────────────────────
describe("quiz routes", () => {
  it("GET 400 when lessonId is missing", async () => {
    const res = await getQuiz(makeReq({ token: ADMIN }));
    expect(res.status).toBe(400);
  });

  it("GET lists quizzes", async () => {
    mQuizFindMany.mockResolvedValue([{ id: "q1" }] as never);
    const res = await getQuiz(makeReq({ token: ADMIN, query: { lessonId: "l1" } }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.quizzes as unknown[]).length).toBe(1);
  });

  it("POST 400 when required fields are missing", async () => {
    const res = await createQuiz(makeReq({ token: ADMIN, body: { lessonId: "l1" } }));
    expect(res.status).toBe(400);
  });

  it("POST creates a quiz (answer coerced to number)", async () => {
    mQuizCreate.mockResolvedValue({ id: "q1" } as never);
    const res = await createQuiz(makeReq({
      token: ADMIN,
      body: { lessonId: "l1", question: "Q?", options: ["a", "b"], answer: "1" },
    }));
    expect(res.status).toBe(200);
    const arg = mQuizCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.answer).toBe(1);
  });

  it("PUT updates a quiz", async () => {
    mQuizUpdate.mockResolvedValue({ id: "q1" } as never);
    const res = await putQuiz(makeReq({ token: ADMIN, body: { question: "New?" } }), ctx("q1"));
    expect(res.status).toBe(200);
  });

  it("DELETE removes a quiz", async () => {
    mQuizDelete.mockResolvedValue({ id: "q1" } as never);
    const res = await deleteQuiz(makeReq({ token: ADMIN }), ctx("q1"));
    expect(res.status).toBe(200);
    expect(mQuizDelete).toHaveBeenCalledWith({ where: { id: "q1" } });
  });

  it("DELETE 403 for a non-admin", async () => {
    const res = await deleteQuiz(makeReq({ token: STUDENT }), ctx("q1"));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/homework
// ─────────────────────────────────────────────────────────────
describe("POST /api/admin/homework", () => {
  it("403 for a non-admin", async () => {
    const res = await createHomework(makeReq({ token: STUDENT, body: {} }));
    expect(res.status).toBe(403);
  });

  it("400 when required fields are missing", async () => {
    const res = await createHomework(makeReq({ token: ADMIN, body: { lessonId: "l1" } }));
    expect(res.status).toBe(400);
  });

  it("404 when the lesson does not exist", async () => {
    mLessonFind.mockResolvedValue(null as never);
    const res = await createHomework(makeReq({
      token: ADMIN,
      body: { lessonId: "l1", title: "HW", description: "do it" },
    }));
    expect(res.status).toBe(404);
  });

  it("creates homework and notifies enrolled students", async () => {
    mLessonFind.mockResolvedValue({
      id: "l1",
      module: { course: { id: "c1", title: "Course A" } },
    } as never);
    mHomeworkFindFirst.mockResolvedValue({ order: 2 } as never);
    mHomeworkCreate.mockResolvedValue({ id: "hw1", title: "HW" } as never);
    mEnrollmentFindMany.mockResolvedValue([{ userId: "s1" }, { userId: "s2" }] as never);

    const res = await createHomework(makeReq({
      token: ADMIN,
      body: { lessonId: "l1", title: "HW", description: "do it", difficulty: "hard" },
    }));
    const body = await readJson(res);
    expect(res.status).toBe(201);
    expect(body.message).toContain("created");
    // order increments from last (2 → 3)
    const arg = mHomeworkCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.order).toBe(3);
    expect(mNotifyHomework).toHaveBeenCalledTimes(2);
  });

  it("still creates homework when there are no enrollments", async () => {
    mLessonFind.mockResolvedValue({
      id: "l1",
      module: { course: { id: "c1", title: "Course A" } },
    } as never);
    mHomeworkFindFirst.mockResolvedValue(null as never);
    mHomeworkCreate.mockResolvedValue({ id: "hw2", title: "HW" } as never);
    mEnrollmentFindMany.mockResolvedValue([] as never);

    const res = await createHomework(makeReq({
      token: ADMIN,
      body: { lessonId: "l1", title: "HW", description: "do it" },
    }));
    expect(res.status).toBe(201);
    // first homework → order 1
    const arg = mHomeworkCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.order).toBe(1);
  });
});
