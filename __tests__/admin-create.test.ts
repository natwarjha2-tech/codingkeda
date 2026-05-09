/**
 * Unit tests — POST /api/admin/courses
 *              POST /api/admin/modules
 *              POST /api/admin/lessons
 *
 * Mocks: prisma, app/lib/middleware (requireAdmin)
 * No real DB, no real JWT.
 */

import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    course: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    module: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    lesson: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
  },
}));

jest.mock("@/app/lib/middleware", () => ({
  requireAdmin: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { GET as getCourses, POST as createCourse } from "@/app/api/admin/courses/route";
import { POST as createModule } from "@/app/api/admin/modules/route";
import { POST as createLesson } from "@/app/api/admin/lessons/route";

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockCourseCreate = prisma.course.create as jest.MockedFunction<typeof prisma.course.create>;
const mockCourseFindUnique = prisma.course.findUnique as jest.MockedFunction<typeof prisma.course.findUnique>;
const mockCourseFindMany = prisma.course.findMany as jest.MockedFunction<typeof prisma.course.findMany>;
const mockModuleCreate = prisma.module.create as jest.MockedFunction<typeof prisma.module.create>;
const mockModuleFindUnique = prisma.module.findUnique as jest.MockedFunction<typeof prisma.module.findUnique>;
const mockModuleFindFirst = prisma.module.findFirst as jest.MockedFunction<typeof prisma.module.findFirst>;
const mockLessonCreate = prisma.lesson.create as jest.MockedFunction<typeof prisma.lesson.create>;
const mockLessonFindFirst = prisma.lesson.findFirst as jest.MockedFunction<typeof prisma.lesson.findFirst>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_COURSE = {
  id: "course-uuid-1",
  title: "Python Basics",
  subtitle: "Learn Python from scratch",
  category: "Programming",
  instructor: "Rahul Sharma",
  institute: "IIT Delhi",
  price: 999,
  isFree: false,
  totalHours: 20,
  totalVideos: 40,
  hasCert: true,
  color: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  icon: "fab fa-python",
  isActive: true,
  createdAt: new Date(),
};

const MOCK_MODULE = {
  id: "module-uuid-1",
  courseId: "course-uuid-1",
  title: "Introduction",
  order: 1,
};

const MOCK_LESSON = {
  id: "lesson-uuid-1",
  moduleId: "module-uuid-1",
  title: "Variables",
  duration: "10:00",
  isFree: false,
  order: 1,
  videoUrl: "",
  notes: "",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock.token" },
    body: JSON.stringify(body),
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Admin auth passes by default in all tests
  mockRequireAdmin.mockReturnValue({ user: { userId: "admin-1", email: "admin@test.com", role: "admin" } });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/courses
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/courses", () => {
  it("200 — returns all courses for admin", async () => {
    mockCourseFindMany.mockResolvedValue([MOCK_COURSE] as never);

    const res = await getCourses(req({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.courses).toHaveLength(1);
  });

  it("200 — returns empty array when no courses", async () => {
    mockCourseFindMany.mockResolvedValue([] as never);

    const res = await getCourses(req({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.courses).toHaveLength(0);
  });

  it("401 — no token returns unauthorized", async () => {
    mockRequireAdmin.mockReturnValue({
      error: new Response(JSON.stringify({ success: false, message: "Unauthorized." }), { status: 401 }) as never,
    });

    const res = await getCourses(req({}));
    expect(res.status).toBe(401);
  });

  it("500 — DB crash returns 500", async () => {
    mockCourseFindMany.mockRejectedValue(new Error("DB down") as never);

    const res = await getCourses(req({}));
    const body = await res.json();
    expect(res.status).toBe(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/courses
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/courses", () => {
  const validBody = {
    title: "Python Basics",
    subtitle: "Learn Python from scratch",
    category: "Programming",
    instructor: "Rahul Sharma",
    institute: "IIT Delhi",
    price: "999",
    totalHours: "20",
    totalVideos: "40",
    color: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
    icon: "fab fa-python",
  };

  it("201 — valid input creates course and returns it", async () => {
    mockCourseCreate.mockResolvedValue(MOCK_COURSE as never);

    const res = await createCourse(req(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.course.title).toBe("Python Basics");
  });

  it("201 — institute defaults to empty string when not provided", async () => {
    mockCourseCreate.mockResolvedValue(MOCK_COURSE as never);
    const { institute: _, ...bodyWithoutInstitute } = validBody;

    await createCourse(req(bodyWithoutInstitute));

    expect(mockCourseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ institute: "" }) })
    );
  });

  it("201 — color defaults when not provided", async () => {
    mockCourseCreate.mockResolvedValue(MOCK_COURSE as never);
    const { color: _, ...bodyWithoutColor } = validBody;

    await createCourse(req(bodyWithoutColor));

    expect(mockCourseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ color: "from-purple-500 to-pink-500" }) })
    );
  });

  it("201 — icon defaults when not provided", async () => {
    mockCourseCreate.mockResolvedValue(MOCK_COURSE as never);
    const { icon: _, ...bodyWithoutIcon } = validBody;

    await createCourse(req(bodyWithoutIcon));

    expect(mockCourseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ icon: "fa-book" }) })
    );
  });

  it("201 — isFree is true when price is 0", async () => {
    mockCourseCreate.mockResolvedValue({ ...MOCK_COURSE, price: 0, isFree: true } as never);

    const res = await createCourse(req({ ...validBody, price: "0" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockCourseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isFree: true, price: 0 }) })
    );
  });

  it("201 — hasCert defaults to true when not provided", async () => {
    mockCourseCreate.mockResolvedValue(MOCK_COURSE as never);

    await createCourse(req(validBody));

    expect(mockCourseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ hasCert: true }) })
    );
  });

  it("401 — no token returns unauthorized", async () => {
    mockRequireAdmin.mockReturnValue({
      error: new Response(JSON.stringify({ success: false, message: "Unauthorized." }), { status: 401 }) as never,
    });

    const res = await createCourse(req(validBody));
    expect(res.status).toBe(401);
  });

  it("400 — missing title", async () => {
    const res = await createCourse(req({ ...validBody, title: "" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — missing category", async () => {
    const res = await createCourse(req({ ...validBody, category: "" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — negative price", async () => {
    const res = await createCourse(req({ ...validBody, price: "-100" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/invalid price/i);
  });

  it("400 — negative totalHours", async () => {
    const res = await createCourse(req({ ...validBody, totalHours: "-5" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("500 — DB crash returns 500", async () => {
    mockCourseCreate.mockRejectedValue(new Error("DB down") as never);

    const res = await createCourse(req(validBody));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.message).toMatch(/internal server error/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/modules
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/modules", () => {
  const validBody = { courseId: "course-uuid-1", title: "Introduction" };

  it("201 — valid input creates module and returns it", async () => {
    mockCourseFindUnique.mockResolvedValue(MOCK_COURSE as never);
    mockModuleFindFirst.mockResolvedValue(null);
    mockModuleCreate.mockResolvedValue(MOCK_MODULE as never);

    const res = await createModule(req(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.module.title).toBe("Introduction");
  });

  it("201 — order auto-assigned as lastModule.order + 1", async () => {
    mockCourseFindUnique.mockResolvedValue(MOCK_COURSE as never);
    mockModuleFindFirst.mockResolvedValue({ ...MOCK_MODULE, order: 3 } as never);
    mockModuleCreate.mockResolvedValue({ ...MOCK_MODULE, order: 4 } as never);

    await createModule(req(validBody));

    expect(mockModuleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 4 }) })
    );
  });

  it("201 — order starts at 1 when no modules exist", async () => {
    mockCourseFindUnique.mockResolvedValue(MOCK_COURSE as never);
    mockModuleFindFirst.mockResolvedValue(null);
    mockModuleCreate.mockResolvedValue(MOCK_MODULE as never);

    await createModule(req(validBody));

    expect(mockModuleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 1 }) })
    );
  });

  it("400 — missing courseId", async () => {
    const res = await createModule(req({ title: "Introduction" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — missing title", async () => {
    const res = await createModule(req({ courseId: "course-uuid-1" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("404 — course not found", async () => {
    mockCourseFindUnique.mockResolvedValue(null);

    const res = await createModule(req(validBody));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.message).toMatch(/course not found/i);
  });

  it("500 — DB crash returns 500", async () => {
    mockCourseFindUnique.mockResolvedValue(MOCK_COURSE as never);
    mockModuleFindFirst.mockResolvedValue(null);
    mockModuleCreate.mockRejectedValue(new Error("DB down") as never);

    const res = await createModule(req(validBody));
    const body = await res.json();
    expect(res.status).toBe(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/lessons
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/lessons", () => {
  const validBody = { moduleId: "module-uuid-1", title: "Variables" };

  it("201 — valid input creates lesson and returns it", async () => {
    mockModuleFindUnique.mockResolvedValue(MOCK_MODULE as never);
    mockLessonFindFirst.mockResolvedValue(null);
    mockLessonCreate.mockResolvedValue(MOCK_LESSON as never);

    const res = await createLesson(req(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.lesson.title).toBe("Variables");
  });

  it("201 — duration defaults to 00:00 when not provided", async () => {
    mockModuleFindUnique.mockResolvedValue(MOCK_MODULE as never);
    mockLessonFindFirst.mockResolvedValue(null);
    mockLessonCreate.mockResolvedValue(MOCK_LESSON as never);

    await createLesson(req(validBody));

    expect(mockLessonCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ duration: "00:00" }) })
    );
  });

  it("201 — isFree defaults to false when not provided", async () => {
    mockModuleFindUnique.mockResolvedValue(MOCK_MODULE as never);
    mockLessonFindFirst.mockResolvedValue(null);
    mockLessonCreate.mockResolvedValue(MOCK_LESSON as never);

    await createLesson(req(validBody));

    expect(mockLessonCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isFree: false }) })
    );
  });

  it("201 — order auto-assigned as lastLesson.order + 1", async () => {
    mockModuleFindUnique.mockResolvedValue(MOCK_MODULE as never);
    mockLessonFindFirst.mockResolvedValue({ ...MOCK_LESSON, order: 5 } as never);
    mockLessonCreate.mockResolvedValue({ ...MOCK_LESSON, order: 6 } as never);

    await createLesson(req(validBody));

    expect(mockLessonCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 6 }) })
    );
  });

  it("201 — videoUrl and notes are empty strings by default", async () => {
    mockModuleFindUnique.mockResolvedValue(MOCK_MODULE as never);
    mockLessonFindFirst.mockResolvedValue(null);
    mockLessonCreate.mockResolvedValue(MOCK_LESSON as never);

    await createLesson(req(validBody));

    expect(mockLessonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ videoUrl: "", notes: "" }),
      })
    );
  });

  it("400 — missing moduleId", async () => {
    const res = await createLesson(req({ title: "Variables" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — missing title", async () => {
    const res = await createLesson(req({ moduleId: "module-uuid-1" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("404 — module not found", async () => {
    mockModuleFindUnique.mockResolvedValue(null);

    const res = await createLesson(req(validBody));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.message).toMatch(/module not found/i);
  });

  it("500 — DB crash returns 500", async () => {
    mockModuleFindUnique.mockResolvedValue(MOCK_MODULE as never);
    mockLessonFindFirst.mockResolvedValue(null);
    mockLessonCreate.mockRejectedValue(new Error("DB down") as never);

    const res = await createLesson(req(validBody));
    const body = await res.json();
    expect(res.status).toBe(500);
  });
});
