import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const { error, user } = requireAuth(req);
    if (error) return error;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return apiError(404, "Course not found.");

    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user!.userId, courseId } },
      update: {},
      create: { userId: user!.userId, courseId },
    });

    await syncStudentOnEnroll(user!.userId);
    return apiSuccess({ message: "Enrolled successfully." });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
