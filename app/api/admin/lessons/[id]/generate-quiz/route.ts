import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * POST /api/admin/lessons/[id]/generate-quiz
 * Auto-generate quiz and exercise from lesson PDF using Gemini AI
 * Requires admin authentication
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, message: "AI service not configured. Add GEMINI_API_KEY to environment." },
        { status: 503 }
      );
    }

    const { id: lessonId } = await params;

    // Get lesson with notes (PDF URL)
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true, title: true } } },
    });

    if (!lesson) {
      return NextResponse.json(
        { success: false, message: "Lesson not found." },
        { status: 404 }
      );
    }

    if (!lesson.notes) {
      return NextResponse.json(
        { success: false, message: "No PDF notes found for this lesson. Upload notes first." },
        { status: 400 }
      );
    }

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

      // Use pdf-parse
      const pdf = require("pdf-parse");
      const pdfData = await pdf(pdfBuffer);
      pdfText = pdfData.text;
    } catch (pdfErr) {
      console.error("PDF extraction error:", pdfErr);
      // Fallback: use lesson title + notes URL as context for AI
      pdfText = `Lesson: ${lesson.title}. Module: ${lesson.module.title}. This is a coding/programming lesson. Generate relevant quiz questions and exercises based on the topic "${lesson.title}".`;
    }

    if (!pdfText || pdfText.trim().length < 10) {
      return NextResponse.json(
        { success: false, message: "Could not extract content. Please ensure the PDF has readable text." },
        { status: 400 }
      );
    }

    // Truncate to avoid token limits (max ~8000 chars)
    const truncatedText = pdfText.substring(0, 8000);

    // Call Gemini API
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

    let aiResponse;
    try {
      const geminiRes = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      });

      if (!geminiRes.ok) {
        throw new Error(`Gemini API error: ${geminiRes.status}`);
      }

      const geminiData = await geminiRes.json();
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Clean response — remove markdown code blocks if present
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      aiResponse = JSON.parse(cleaned);
    } catch (err) {
      console.error("Gemini API error:", err);
      return NextResponse.json(
        { success: false, message: "AI failed to generate content. Please try again." },
        { status: 502 }
      );
    }

    // Validate response structure
    if (!aiResponse.quizzes || !Array.isArray(aiResponse.quizzes) || aiResponse.quizzes.length === 0) {
      return NextResponse.json(
        { success: false, message: "AI generated invalid quiz data. Please try again." },
        { status: 502 }
      );
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
          options: q.options,
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
            hints: ex.hints || null,
            order: i + 1,
          },
        });
        createdExercises.push(exercise);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${createdQuizzes.length} quizzes and ${createdExercises.length} exercises.`,
      quizzes: createdQuizzes,
      exercises: createdExercises,
    });
  } catch (err) {
    console.error("Generate quiz error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
