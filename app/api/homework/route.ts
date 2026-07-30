import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/homework?lessonId=xxx
 * Get all homework problems for a lesson (public — no auth required)
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) return apiError(400, "lessonId is required.");

    const homeworks = await prisma.homework.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
      select: { id: true, title: true, description: true, difficulty: true, order: true },
    });

    return apiSuccess({ homeworks });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
