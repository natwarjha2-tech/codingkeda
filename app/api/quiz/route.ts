import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/quiz?lessonId=xxx
 * Get all quizzes for a lesson
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");

    if (!lessonId) {
      return NextResponse.json(
        { success: false, message: "lessonId is required." },
        { status: 400 }
      );
    }

    const quizzes = await prisma.quiz.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        question: true,
        options: true,
        answer: true,
        explanation: true,
        order: true,
      },
    });

    return NextResponse.json({ success: true, quizzes });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quiz
 * Submit a quiz attempt
 * Body: { quizId, selected, courseId }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const { quizId, selected, courseId } = await req.json();

    if (!quizId || selected === undefined || !courseId) {
      return NextResponse.json(
        { success: false, message: "quizId, selected, and courseId are required." },
        { status: 400 }
      );
    }

    // Get quiz to check answer
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found." },
        { status: 404 }
      );
    }

    const correct = quiz.answer === Number(selected);

    // Save attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: payload.userId,
        quizId,
        courseId,
        selected: Number(selected),
        correct,
      },
    });

    return NextResponse.json({
      success: true,
      correct,
      correctAnswer: quiz.answer,
      explanation: quiz.explanation,
      attemptId: attempt.id,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
