import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * POST /api/admin/quiz — Add single quiz
 * GET /api/admin/quiz?lessonId=xxx — List all quizzes for a lesson (for edit UI)
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) {
      return NextResponse.json({ success: false, message: "lessonId required." }, { status: 400 });
    }

    const quizzes = await prisma.quiz.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, quizzes });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, question, options, answer, explanation } = await req.json();

    if (!lessonId || !question || !options || answer === undefined) {
      return NextResponse.json(
        { success: false, message: "lessonId, question, options, and answer are required." },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        lessonId,
        question,
        options,
        answer: Number(answer),
        explanation: explanation || null,
        order: 0,
      },
    });

    return NextResponse.json({ success: true, quiz });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
