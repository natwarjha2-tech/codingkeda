import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/admin/exercises?lessonId=xxx — List exercises for edit UI
 * POST /api/admin/exercises — Add single exercise
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) return apiError(400, "lessonId required.");

    const exercises = await prisma.exercise.findMany({
      where: { lessonId }, orderBy: { order: "asc" }, include: { testCases: { orderBy: { order: "asc" } } },
    });
    return apiSuccess({ exercises });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, title, description, difficulty, type, language } = await req.json();
    if (!lessonId || !title || !description || !type) {
      return apiError(400, "lessonId, title, description, and type are required.");
    }

    const exercise = await prisma.exercise.create({
      data: { lessonId, title, description, difficulty: difficulty || "medium", type, language: type === "coding" ? (language || "c") : null, order: 0 },
    });

    // Auto-trigger best solution generation for coding exercises (non-blocking)
    if (type === "coding") {
      triggerBestSolutionGeneration(exercise.id).catch(() => {});
    }

    return apiSuccess({ exercise });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

async function triggerBestSolutionGeneration(exerciseId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
  await fetch(`${baseUrl}/api/coding-problems/best-solution`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ problemId: exerciseId }),
  });
}
