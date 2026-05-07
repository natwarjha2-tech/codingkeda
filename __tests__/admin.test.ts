import { POST as adminLogin } from "@/app/api/auth/admin-login/route";
import { POST as uploadMedia } from "@/app/api/admin/upload/route";
import { POST as updateVideo } from "@/app/api/admin/lessons/[id]/update-video/route";
import { POST as updatePdf } from "@/app/api/admin/lessons/[id]/update-pdf/route";
import { POST as updateCourse } from "@/app/api/admin/courses/[id]/update/route";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import bcrypt from "bcryptjs";

// Mock NextRequest
const createMockRequest = (body: unknown, token?: string) => {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return {
    json: async () => body,
    headers,
  } as any;
};

describe("Admin API Routes", () => {
  let adminToken: string;
  let adminUserId: string;
  let testCourseId: string;
  let testModuleId: string;
  let testLessonId: string;

  beforeAll(async () => {
    // Create admin user
    const hashedPassword = await bcrypt.hash("admin12345", 10);
    const adminUser = await prisma.user.create({
      data: {
        email: "testadmin@codingkeda.com",
        password: hashedPassword,
        name: "Test Admin",
        role: "admin",
      },
    });
    adminUserId = adminUser.id;
    adminToken = signToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    // Create test course, module, and lesson
    const course = await prisma.course.create({
      data: {
        title: "Test Course",
        subtitle: "Test Subtitle",
        category: "Programming",
        instructor: "Test Instructor",
        institute: "Test Institute",
        price: 999,
        totalHours: 10,
        totalVideos: 20,
        color: "from-blue-500 to-purple-500",
        icon: "fa-code",
      },
    });
    testCourseId = course.id;

    const module = await prisma.module.create({
      data: {
        courseId: course.id,
        title: "Test Module",
        order: 1,
      },
    });
    testModuleId = module.id;

    const lesson = await prisma.lesson.create({
      data: {
        moduleId: module.id,
        title: "Test Lesson",
        duration: "10:00",
        order: 1,
      },
    });
    testLessonId = lesson.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.lesson.deleteMany({ where: { moduleId: testModuleId } });
    await prisma.module.deleteMany({ where: { courseId: testCourseId } });
    await prisma.course.delete({ where: { id: testCourseId } });
    await prisma.user.delete({ where: { id: adminUserId } });
  });

  describe("POST /api/auth/admin-login", () => {
    it("should login admin successfully", async () => {
      const req = createMockRequest({
        email: "testadmin@codingkeda.com",
        password: "admin12345",
      });

      const response = await adminLogin(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
      expect(data.user.role).toBe("admin");
    });

    it("should reject non-admin user", async () => {
      // Create regular user
      const hashedPassword = await bcrypt.hash("user12345", 10);
      const regularUser = await prisma.user.create({
        data: {
          email: "regularuser@test.com",
          password: hashedPassword,
          name: "Regular User",
          role: "user",
        },
      });

      const req = createMockRequest({
        email: "regularuser@test.com",
        password: "user12345",
      });

      const response = await adminLogin(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);

      // Cleanup
      await prisma.user.delete({ where: { id: regularUser.id } });
    });

    it("should reject invalid credentials", async () => {
      const req = createMockRequest({
        email: "testadmin@codingkeda.com",
        password: "wrongpassword",
      });

      const response = await adminLogin(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should validate email format", async () => {
      const req = createMockRequest({
        email: "invalidemail",
        password: "admin12345",
      });

      const response = await adminLogin(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should validate password length", async () => {
      const req = createMockRequest({
        email: "testadmin@codingkeda.com",
        password: "short",
      });

      const response = await adminLogin(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/admin/lessons/[id]/update-video", () => {
    it("should update lesson video URL", async () => {
      const req = createMockRequest(
        {
          videoUrl: "https://example.com/video.mp4",
        },
        adminToken
      );

      const response = await updateVideo(req, {
        params: Promise.resolve({ id: testLessonId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.lesson.videoUrl).toBe("https://example.com/video.mp4");
    });

    it("should reject without authentication", async () => {
      const req = createMockRequest({
        videoUrl: "https://example.com/video.mp4",
      });

      const response = await updateVideo(req, {
        params: Promise.resolve({ id: testLessonId }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should reject invalid lesson ID", async () => {
      const req = createMockRequest(
        {
          videoUrl: "https://example.com/video.mp4",
        },
        adminToken
      );

      const response = await updateVideo(req, {
        params: Promise.resolve({ id: "invalid-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it("should require videoUrl or mediaId", async () => {
      const req = createMockRequest({}, adminToken);

      const response = await updateVideo(req, {
        params: Promise.resolve({ id: testLessonId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/admin/lessons/[id]/update-pdf", () => {
    it("should update lesson PDF notes", async () => {
      const req = createMockRequest(
        {
          pdfUrl: "https://example.com/notes.pdf",
        },
        adminToken
      );

      const response = await updatePdf(req, {
        params: Promise.resolve({ id: testLessonId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.lesson.notes).toBe("https://example.com/notes.pdf");
    });

    it("should reject without authentication", async () => {
      const req = createMockRequest({
        pdfUrl: "https://example.com/notes.pdf",
      });

      const response = await updatePdf(req, {
        params: Promise.resolve({ id: testLessonId }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/admin/courses/[id]/update", () => {
    it("should update course details", async () => {
      const req = createMockRequest(
        {
          title: "Updated Course Title",
          price: 1999,
          rating: 4.8,
        },
        adminToken
      );

      const response = await updateCourse(req, {
        params: Promise.resolve({ id: testCourseId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.course.title).toBe("Updated Course Title");
      expect(data.course.price).toBe(1999);
      expect(data.course.rating).toBe(4.8);
    });

    it("should reject without authentication", async () => {
      const req = createMockRequest({
        title: "Updated Title",
      });

      const response = await updateCourse(req, {
        params: Promise.resolve({ id: testCourseId }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should validate price value", async () => {
      const req = createMockRequest(
        {
          price: -100,
        },
        adminToken
      );

      const response = await updateCourse(req, {
        params: Promise.resolve({ id: testCourseId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should validate rating range", async () => {
      const req = createMockRequest(
        {
          rating: 6.0,
        },
        adminToken
      );

      const response = await updateCourse(req, {
        params: Promise.resolve({ id: testCourseId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should reject empty update", async () => {
      const req = createMockRequest({}, adminToken);

      const response = await updateCourse(req, {
        params: Promise.resolve({ id: testCourseId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should handle partial updates", async () => {
      const req = createMockRequest(
        {
          rating: 4.9,
        },
        adminToken
      );

      const response = await updateCourse(req, {
        params: Promise.resolve({ id: testCourseId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.course.rating).toBe(4.9);
    });
  });
});
