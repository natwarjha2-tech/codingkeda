/**
 * Unit tests — Admin API routes (admin-login, update-video, update-pdf, update-course)
 *
 * FULLY MOCKED — no real database, no AWS, no network. prisma, bcrypt, S3, the
 * lesson pipeline and the video processor are all mocked, so these tests NEVER
 * touch the production Neon DB (previously this file created/deleted real rows
 * via beforeAll/afterAll — that is removed). Each test sets only the mock return
 * values its route needs, mirroring the pattern used across the other suites.
 */

// Ensure a valid JWT secret for the test run (app/lib/auth.ts fails fast if it's
// shorter than 32 chars). Set BEFORE importing any route that loads auth.ts.
// Test-only env — does not touch production config or the database.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-only-jwt-secret-value-0123456789-abcdef";
}

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn(), update: jest.fn() },
    course: { findUnique: jest.fn(), update: jest.fn() },
    media: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    lessonReaction: { deleteMany: jest.fn() },
  },
}));

jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: { hash: jest.fn(), compare: jest.fn() },
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Side-effects that would otherwise reach AWS/background work — mocked to no-ops
// so a route's fire-and-forget cleanup/pipeline never does anything real.
jest.mock("@/app/lib/s3", () => ({
  deleteVideoMediaS3: jest.fn().mockResolvedValue(undefined),
  deleteFileMediaS3: jest.fn().mockResolvedValue(undefined),
  getS3KeyFromUrl: jest.fn(() => null),
}));
jest.mock("@/app/lib/lesson-pipeline", () => ({ triggerLessonPipeline: jest.fn() }));
jest.mock("@/app/lib/video-processor", () => ({ cancelVideoProcessing: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { POST as adminLogin } from "@/app/api/auth/admin-login/route";
import { POST as updateVideo } from "@/app/api/admin/lessons/[id]/update-video/route";
import { POST as updatePdf } from "@/app/api/admin/lessons/[id]/update-pdf/route";
import { POST as updateCourse } from "@/app/api/admin/courses/[id]/update/route";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import bcrypt from "bcryptjs";

const mUserFind = prisma.user.findUnique as jest.MockedFunction<typeof prisma.user.findUnique>;
const mLessonFind = prisma.lesson.findUnique as jest.MockedFunction<typeof prisma.lesson.findUnique>;
const mLessonUpdate = prisma.lesson.update as jest.MockedFunction<typeof prisma.lesson.update>;
const mCourseFind = prisma.course.findUnique as jest.MockedFunction<typeof prisma.course.findUnique>;
const mCourseUpdate = prisma.course.update as jest.MockedFunction<typeof prisma.course.update>;
const mReactionDeleteMany = prisma.lessonReaction.deleteMany as jest.MockedFunction<typeof prisma.lessonReaction.deleteMany>;
const mCompare = bcrypt.compare as unknown as jest.Mock;

// A real (unsigned-by-DB) admin token — signToken is a pure JWT sign, no DB.
const ADMIN_TOKEN = signToken({ userId: "admin-1", email: "testadmin@codingkeda.com", role: "admin" });
const LESSON_ID = "lesson-1";
const COURSE_ID = "course-1";

const createMockRequest = (body: unknown, token?: string) => {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  return { json: async () => body, headers } as never;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/admin-login
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/admin-login", () => {
  it("should login admin successfully", async () => {
    mUserFind.mockResolvedValue({
      id: "admin-1", email: "testadmin@codingkeda.com", password: "hashed",
      name: "Test Admin", role: "admin",
    } as never);
    mCompare.mockResolvedValue(true);

    const res = await adminLogin(createMockRequest({ email: "testadmin@codingkeda.com", password: "admin12345" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe("admin");
  });

  it("should reject non-admin user", async () => {
    mUserFind.mockResolvedValue({
      id: "user-1", email: "regularuser@test.com", password: "hashed",
      name: "Regular User", role: "user",
    } as never);

    const res = await adminLogin(createMockRequest({ email: "regularuser@test.com", password: "user12345" }));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it("should reject invalid credentials", async () => {
    mUserFind.mockResolvedValue({
      id: "admin-1", email: "testadmin@codingkeda.com", password: "hashed",
      name: "Test Admin", role: "admin",
    } as never);
    mCompare.mockResolvedValue(false);

    const res = await adminLogin(createMockRequest({ email: "testadmin@codingkeda.com", password: "wrongpassword" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("should validate email format", async () => {
    const res = await adminLogin(createMockRequest({ email: "invalidemail", password: "admin12345" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should validate password length", async () => {
    const res = await adminLogin(createMockRequest({ email: "testadmin@codingkeda.com", password: "short" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/lessons/[id]/update-video
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/lessons/[id]/update-video", () => {
  it("should update lesson video URL", async () => {
    mLessonFind.mockResolvedValue({ id: LESSON_ID, videoUrl: "", notes: "", moduleId: "m-1" } as never);
    mLessonUpdate.mockResolvedValue({
      id: LESSON_ID, title: "Test Lesson", videoUrl: "https://example.com/video.mp4",
      duration: "00:00", viewCount: 0, moduleId: "m-1",
      module: { id: "m-1", title: "Test Module", courseId: COURSE_ID },
    } as never);
    mReactionDeleteMany.mockResolvedValue({ count: 0 } as never);

    const res = await updateVideo(
      createMockRequest({ videoUrl: "https://example.com/video.mp4" }, ADMIN_TOKEN),
      { params: Promise.resolve({ id: LESSON_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.lesson.videoUrl).toBe("https://example.com/video.mp4");
  });

  it("should reject without authentication", async () => {
    const res = await updateVideo(
      createMockRequest({ videoUrl: "https://example.com/video.mp4" }),
      { params: Promise.resolve({ id: LESSON_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("should reject invalid lesson ID", async () => {
    mLessonFind.mockResolvedValue(null as never); // lesson not found

    const res = await updateVideo(
      createMockRequest({ videoUrl: "https://example.com/video.mp4" }, ADMIN_TOKEN),
      { params: Promise.resolve({ id: "invalid-uuid" }) }
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it("should require videoUrl or mediaId", async () => {
    const res = await updateVideo(
      createMockRequest({}, ADMIN_TOKEN),
      { params: Promise.resolve({ id: LESSON_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/lessons/[id]/update-pdf
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/lessons/[id]/update-pdf", () => {
  it("should update lesson PDF notes", async () => {
    mLessonFind.mockResolvedValue({ id: LESSON_ID, videoUrl: "", notes: "", moduleId: "m-1" } as never);
    mLessonUpdate.mockResolvedValue({
      id: LESSON_ID, title: "Test Lesson", notes: "https://example.com/notes.pdf",
      moduleId: "m-1", module: { id: "m-1", title: "Test Module", courseId: COURSE_ID },
    } as never);

    const res = await updatePdf(
      createMockRequest({ pdfUrl: "https://example.com/notes.pdf" }, ADMIN_TOKEN),
      { params: Promise.resolve({ id: LESSON_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.lesson.notes).toBe("https://example.com/notes.pdf");
  });

  it("should reject without authentication", async () => {
    const res = await updatePdf(
      createMockRequest({ pdfUrl: "https://example.com/notes.pdf" }),
      { params: Promise.resolve({ id: LESSON_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/courses/[id]/update
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/courses/[id]/update", () => {
  const courseRow = (over: Record<string, unknown> = {}) => ({
    id: COURSE_ID, title: "Updated Course Title", subtitle: "", category: "Programming",
    instructor: "Test", instructorEmail: "t@test.com", institute: "", totalHours: 10,
    totalVideos: 20, hasCert: false, color: "", icon: "", isActive: true, rating: 4.8,
    students: 0, _count: { enrollments: 0 }, modules: [], createdAt: new Date(),
    ...over,
  });

  it("should update course details", async () => {
    mCourseFind.mockResolvedValue({ id: COURSE_ID } as never);
    mCourseUpdate.mockResolvedValue(courseRow({ title: "Updated Course Title", rating: 4.8 }) as never);

    const res = await updateCourse(
      createMockRequest({ title: "Updated Course Title", rating: 4.8 }, ADMIN_TOKEN),
      { params: Promise.resolve({ id: COURSE_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.course.title).toBe("Updated Course Title");
    expect(data.course.rating).toBe(4.8);
  });

  it("should reject without authentication", async () => {
    const res = await updateCourse(
      createMockRequest({ title: "Updated Title" }),
      { params: Promise.resolve({ id: COURSE_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("should validate rating range", async () => {
    mCourseFind.mockResolvedValue({ id: COURSE_ID } as never);

    const res = await updateCourse(
      createMockRequest({ rating: 6.0 }, ADMIN_TOKEN),
      { params: Promise.resolve({ id: COURSE_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should reject empty update", async () => {
    mCourseFind.mockResolvedValue({ id: COURSE_ID } as never);

    const res = await updateCourse(
      createMockRequest({}, ADMIN_TOKEN),
      { params: Promise.resolve({ id: COURSE_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should handle partial updates", async () => {
    mCourseFind.mockResolvedValue({ id: COURSE_ID } as never);
    mCourseUpdate.mockResolvedValue(courseRow({ rating: 4.9 }) as never);

    const res = await updateCourse(
      createMockRequest({ rating: 4.9 }, ADMIN_TOKEN),
      { params: Promise.resolve({ id: COURSE_ID }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.course.rating).toBe(4.9);
  });
});
