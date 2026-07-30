import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * POST /api/admin/modules
 * Create a new module inside a course
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { courseId, title, order } = await req.json();
    if (!courseId?.trim() || !title?.trim()) return apiError(400, "courseId and title are required.");

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return apiError(404, "Course not found.");

    let moduleOrder = parseInt(order ?? "0");
    if (!order) {
      const lastModule = await prisma.module.findFirst({ where: { courseId }, orderBy: { order: "desc" } });
      moduleOrder = (lastModule?.order ?? 0) + 1;
    }

    const module = await prisma.module.create({
      data: { courseId: courseId.trim(), title: title.trim(), order: moduleOrder },
    });

    return apiSuccess({ message: "Module created successfully.", module }, 201);
  } catch {
    return apiError(500, "Internal server error.");
  }
}
