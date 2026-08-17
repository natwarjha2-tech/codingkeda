import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";
import { apiSuccess, apiError } from "@/app/lib/response";
import { callGeminiJSON, isGeminiConfigured } from "@/app/lib/gemini";
import { logger } from "@/app/lib/logger";

interface GeneratedQuiz {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

interface GeneratedExercise {
  title: string;
  description: string;
  difficulty?: string;
  starterCode?: string;
  solution?: string;
  hints?: string[];
}

interface GenerateQuizResponse {
  quizzes: GeneratedQuiz[];
  exercises?: GeneratedExercise[];
}

/**
 * POST /api/admin/lessons/[id]/generate-quiz
 * Auto-generate quiz and exercise from lesson PDF using Gemini AI.
 * Requires admin authentication.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    if (!isGeminiConfigured()) {
      return apiError(503, "AI service not configured. Add GEMINI_API_KEY to environment.");
    }

    const { id: lessonId } = await params;

    // Get lesson with notes (PDF URL)
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true, title: true } } },
    });

    if (!lesson) return apiError(404, "Lesson not found.");
    if (!lesson.notes) return apiError(400, "No PDF notes found for this lesson. Upload notes first.");

    // Extract text from PDF
    let pdfText = "";
    try {
      let pdfUrl = lesson.notes;
      if (getS3KeyFromUrl(pdfUrl)) {
        pdfUrl = await getSignedFileUrlFromUrl(pdfUrl, 300);
      }

      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) throw new Error("Failed to fetch PDF");
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

      const pdf = require("pdf-parse");
      const pdfData = await pdf(pdfBuffer);
      pdfText = pdfData.text;
    } catch {
      // Fallback: use lesson title + module context
      pdfText = `Lesson: ${lesson.title}. Module: ${lesson.module.title}. This is a coding/programming lesson. Generate relevant quiz questions and exercises based on the topic "${lesson.title}".`;
    }

    if (!pdfText || pdfText.trim().length < 10) {
      return apiError(400, "Could not extract content. Please ensure the PDF has readable text.");
    }

    // Truncate to avoid token limits (max ~8000 chars)
    const truncatedText = pdfText.substring(0, 8000);

    // Call Gemini AI via centralized client
    const prompt = `You are an expert educator. Based on the following lesson content, generate exactly 5 multiple-choice quiz questions and 2 coding/practice exercises.

LESSON TITLE: "${lesson.title}"
MODULE: "${lesson.module.title}"

CONTENT:
${truncatedText}

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "quizzes": [
    {
      "question": "Clear question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Brief explanation why this is correct"
    }
  ],
  "exercises": [
    {
      "title": "Exercise title",
      "description": "Clear description of what student needs to do",
      "difficulty": "easy",
      "starterCode": "// starter code if applicable",
      "solution": "// solution code",
      "hints": ["hint 1", "hint 2"]
    }
  ]
}

Rules:
- answer is 0-indexed (0=first option, 1=second, etc.)
- difficulty: "easy", "medium", or "hard"
- Make questions test real understanding, not just memorization
- Exercises should be practical and related to the lesson content`;

    const aiResponse = await callGeminiJSON<GenerateQuizResponse>(prompt, {
      temperature: 0.7,
      maxOutputTokens: 4096,
    });

    if (!aiResponse || !aiResponse.quizzes || !Array.isArray(aiResponse.quizzes) || aiResponse.quizzes.length === 0) {
      return apiError(502, "AI failed to generate valid content. Please try again.");
    }

    // Save quizzes to DB
    const createdQuizzes = [];
    for (let i = 0; i < aiResponse.quizzes.length; i++) {
      const q = aiResponse.quizzes[i];
      if (!q.question || !q.options || q.answer === undefined) continue;
      const quiz = await prisma.quiz.create({
        data: {
          lessonId,
          question: q.question,
          options: JSON.parse(JSON.stringify(q.options)),
          answer: Number(q.answer),
          explanation: q.explanation || null,
          order: i + 1,
        },
      });
      createdQuizzes.push(quiz);
    }

    // Save exercises to DB
    const createdExercises = [];
    if (aiResponse.exercises && Array.isArray(aiResponse.exercises)) {
      for (let i = 0; i < aiResponse.exercises.length; i++) {
        const ex = aiResponse.exercises[i];
        if (!ex.title || !ex.description) continue;
        const exercise = await prisma.exercise.create({
          data: {
            lessonId,
            title: ex.title,
            description: ex.description,
            difficulty: ex.difficulty || "medium",
            starterCode: ex.starterCode || null,
            solution: ex.solution || null,
            hints: ex.hints ? JSON.parse(JSON.stringify(ex.hints)) : undefined,
            order: i + 1,
          },
        });
        createdExercises.push(exercise);
      }
    }

    logger.success("admin-generate-quiz", "generated", { lessonId, quizzes: createdQuizzes.length, exercises: createdExercises.length });

    return apiSuccess({
      message: `Generated ${createdQuizzes.length} quizzes and ${createdExercises.length} exercises.`,
      quizzes: createdQuizzes,
      exercises: createdExercises,
    });
  } catch (err) {
    logger.error("admin-generate-quiz", "unhandled_error", { error: err instanceof Error ? err.message : "Unknown" });
    return apiError(500, "Internal server error.");
  }
}
