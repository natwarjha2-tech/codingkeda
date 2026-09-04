import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { notifyNewHomework } from "@/app/lib/notification";

/**
 * POST /api/admin/homework
 * Create a homework problem for a lesson
 * Body: { lessonId, title, description, difficulty }
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, title, description, difficulty } = await req.json();
    if (!lessonId?.trim() || !title?.trim() || !description?.trim()) {
      return apiError(400, "lessonId, title, and description are required.");
    }

    // Include module→course so we can notify enrolled students
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: { select: { id: true, title: true } } } } },
    });
    if (!lesson) return apiError(404, "Lesson not found.");

    const lastHomework = await prisma.homework.findFirst({ where: { lessonId }, orderBy: { order: "desc" } });
    const nextOrder = (lastHomework?.order ?? 0) + 1;

    const homework = await prisma.homework.create({
      data: { lessonId: lessonId.trim(), title: title.trim(), description: description.trim(), difficulty: difficulty?.trim() || "medium", order: nextOrder },
    });

    // Notify all students enrolled in this course (non-blocking)
    try {
      const course = lesson.module?.course;
      if (course) {
        const enrollments = await prisma.enrollment.findMany({
          where: { courseId: course.id },
          select: { userId: true },
        });
        await Promise.all(
          enrollments.map((e) =>
            notifyNewHomework({
              userId: e.userId,
              homeworkId: homework.id,
              title: homework.title,
              courseId: course.id,
              courseName: course.title,
            }).catch(() => {})
          )
        );
      }
    } catch { /* notification failure must not block homework creation */ }

    return apiSuccess({ message: "Homework created successfully.", homework }, 201);
  } catch {
    return apiError(500, "Internal server error.");
  }
}
