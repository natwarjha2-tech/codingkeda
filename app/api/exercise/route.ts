import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { callGeminiJSON, isGeminiConfigured } from "@/app/lib/gemini";

/**
 * GET /api/exercise?lessonId=xxx
 * Get all exercises for a lesson
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) return apiError(400, "lessonId is required.");

    const exercises = await prisma.exercise.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
      select: {
        id: true, title: true, description: true, difficulty: true, type: true,
        language: true, starterCode: true, hints: true, timeLimit: true, memoryLimit: true, order: true,
        bestSolution: true, inputFormat: true, outputFormat: true, constraints: true,
        explanation: true, tags: true, timeComplexity: true, spaceComplexity: true,
      },
    });

    return apiSuccess({ exercises });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST /api/exercise
 * Submit an exercise attempt
 * Body: { exerciseId, code, courseId, language? }
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { exerciseId, code, courseId, language } = await req.json();

    if (!exerciseId || !code?.trim() || !courseId) {
      return apiError(400, "exerciseId, code, and courseId are required.");
    }

    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) return apiError(404, "Exercise not found.");

    // Evaluate using Gemini AI
    let passed = false;
    let feedback = "";

    if (isGeminiConfigured()) {
      const prompt = `You are an expert code reviewer for an EdTech platform. Evaluate this student's exercise submission.

EXERCISE: ${exercise.title || exercise.description}
DESCRIPTION: ${exercise.description}
${exercise.solution ? "EXPECTED SOLUTION: " + exercise.solution : ""}

STUDENT'S ANSWER:
${code}

Respond ONLY with valid JSON (no markdown):
{"passed": true/false, "feedback": "Brief 1-2 sentence feedback explaining why correct or what to improve"}`;

      const aiResult = await callGeminiJSON<{ passed: boolean; feedback: string }>(prompt, {
        temperature: 0.3,
        maxOutputTokens: 256,
      });

      if (aiResult) {
        passed = !!aiResult.passed;
        feedback = aiResult.feedback || "";
      } else {
        passed = true;
        feedback = "Solution submitted successfully.";
      }
    } else {
      passed = code.trim().length >= 10;
      feedback = passed ? "Solution submitted." : "Please write a more detailed solution.";
    }

    // Save submission
    const submission = await prisma.exerciseSubmission.create({
      data: {
        userId: user!.userId,
        exerciseId,
        courseId,
        code: code.trim(),
        language: language || null,
        passed,
      },
    });

    return apiSuccess({
      passed,
      submissionId: submission.id,
      message: passed ? feedback || "Correct! Well done." : feedback || "Not quite right. Keep trying!",
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
