import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

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
      return NextResponse.json(
        { success: false, message: "lessonId and quizzes array required." },
        { status: 400 }
      );
    }

    if (quizzes.length > 10) {
      return NextResponse.json(
        { success: false, message: "Maximum 10 quizzes per batch." },
        { status: 400 }
      );
    }

    // Get current max order for this lesson
    const lastQuiz = await prisma.quiz.findFirst({
      where: { lessonId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    let startOrder = (lastQuiz?.order ?? 0) + 1;

    const created = [];
    for (const q of quizzes) {
      if (!q.question || !q.options || q.answer === undefined) continue;
      const quiz = await prisma.quiz.create({
        data: {
          lessonId,
          question: q.question,
          options: q.options,
          answer: Number(q.answer),
          explanation: q.explanation || null,
          order: startOrder++,
        },
      });
      created.push(quiz);
    }

    return NextResponse.json({
      success: true,
      count: created.length,
      message: `${created.length} quiz(zes) added.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
