import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * POST /api/admin/weekly-streak — Create weekly streak challenge
 * GET /api/admin/weekly-streak?courseId=xxx — List streaks for a course
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, moduleId, courseId, title, description, problem, solution, weekNumber } = await req.json();
    if (!lessonId || !moduleId || !courseId || !title?.trim() || !problem?.trim() || !solution?.trim()) {
      return apiError(400, "lessonId, moduleId, courseId, title, problem, and solution are required.");
    }

    const existing = await prisma.weeklyStreak.findUnique({ where: { lessonId } });
    if (existing) return apiError(409, "Weekly streak already exists for this lesson.");

    const streak = await prisma.weeklyStreak.create({
      data: { lessonId, moduleId, courseId, title: title.trim(), description: description?.trim() || "", problem: problem.trim(), solution: solution.trim(), weekNumber: weekNumber || 1 },
    });

    return apiSuccess({ message: "Weekly streak challenge created.", streak });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const courseId = req.nextUrl.searchParams.get("courseId");
    const streaks = await prisma.weeklyStreak.findMany({ where: courseId ? { courseId } : {}, orderBy: { weekNumber: "asc" } });
    return apiSuccess({ streaks });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
