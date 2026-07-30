import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * GET /api/admin/quiz?lessonId=xxx — List quizzes for a lesson
 * POST /api/admin/quiz — Add single quiz
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) return apiError(400, "lessonId required.");

    const quizzes = await prisma.quiz.findMany({ where: { lessonId }, orderBy: { order: "asc" } });
    return apiSuccess({ quizzes });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, question, options, answer, explanation } = await req.json();
    if (!lessonId || !question || !options || answer === undefined) {
      return apiError(400, "lessonId, question, options, and answer are required.");
    }

    const quiz = await prisma.quiz.create({
      data: { lessonId, question, options, answer: Number(answer), explanation: explanation || null, order: 0 },
    });

    return apiSuccess({ quiz });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
