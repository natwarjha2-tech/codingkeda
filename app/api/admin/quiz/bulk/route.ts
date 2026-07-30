import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * POST /api/admin/quiz/bulk
 * Bulk save multiple quizzes to a lesson at once.
 * Body: { lessonId, quizzes: [{ question, options, answer, explanation }] }
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, quizzes } = await req.json();
    if (!lessonId || !quizzes || !Array.isArray(quizzes) || quizzes.length === 0) {
      return apiError(400, "lessonId and quizzes array required.");
    }
    if (quizzes.length > 10) return apiError(400, "Maximum 10 quizzes per batch.");

    const lastQuiz = await prisma.quiz.findFirst({ where: { lessonId }, orderBy: { order: "desc" }, select: { order: true } });
    let startOrder = (lastQuiz?.order ?? 0) + 1;

    const created = [];
    for (const q of quizzes) {
      if (!q.question || !q.options || q.answer === undefined) continue;
      const quiz = await prisma.quiz.create({
        data: { lessonId, question: q.question, options: q.options, answer: Number(q.answer), explanation: q.explanation || null, order: startOrder++ },
      });
      created.push(quiz);
    }

    return apiSuccess({ count: created.length, message: `${created.length} quiz(zes) added.` });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
