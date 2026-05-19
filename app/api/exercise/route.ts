import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * GET /api/exercise?lessonId=xxx
 * Get all exercises for a lesson
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

    const exercises = await prisma.exercise.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        starterCode: true,
        hints: true,
        order: true,
        // Don't expose solution — check server-side
      },
    });

    return NextResponse.json({ success: true, exercises });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/exercise
 * Submit an exercise attempt
 * Body: { exerciseId, code, courseId }
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
    const { exerciseId, code, courseId } = await req.json();

    if (!exerciseId || !code?.trim() || !courseId) {
      return NextResponse.json(
        { success: false, message: "exerciseId, code, and courseId are required." },
        { status: 400 }
      );
    }

    // Get exercise
    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) {
      return NextResponse.json(
        { success: false, message: "Exercise not found." },
        { status: 404 }
      );
    }

    // Evaluate using Gemini AI
    let passed = false;
    let feedback = "";

    const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
    if (GEMINI_KEY) {
      try {
        const prompt = `You are an expert code reviewer for an EdTech platform. Evaluate this student's exercise submission.

EXERCISE: ${exercise.title || exercise.description}
DESCRIPTION: ${exercise.description}
${exercise.solution ? "EXPECTED SOLUTION: " + exercise.solution : ""}

STUDENT'S ANSWER:
${code}

Respond ONLY with valid JSON (no markdown):
{"passed": true/false, "feedback": "Brief 1-2 sentence feedback explaining why correct or what to improve"}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          try {
            const aiResult = JSON.parse(cleaned);
            passed = !!aiResult.passed;
            feedback = aiResult.feedback || "";
          } catch {
            // JSON parse failed — check if raw text indicates correct
            passed = rawText.toLowerCase().includes('"passed": true') || rawText.toLowerCase().includes('"passed":true');
            feedback = "Solution evaluated.";
          }
        } else {
          // API error — accept submission gracefully
          passed = true;
          feedback = "Solution submitted successfully.";
        }
      } catch {
        // AI evaluation failed — accept submission
        passed = true;
        feedback = "Solution submitted successfully.";
      }
    } else {
      // No AI key — accept any meaningful submission
      passed = code.trim().length >= 10;
      feedback = passed ? "Solution submitted." : "Please write a more detailed solution.";
    }

    // Save submission
    const submission = await prisma.exerciseSubmission.create({
      data: {
        userId: payload.userId,
        exerciseId,
        courseId,
        code: code.trim(),
        passed,
      },
    });

    return NextResponse.json({
      success: true,
      passed,
      submissionId: submission.id,
      message: passed
        ? feedback || "Correct! Well done."
        : feedback || "Not quite right. Keep trying!",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
