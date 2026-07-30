import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { extractUser } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { callGeminiJSON, isGeminiConfigured } from "@/app/lib/gemini";

/**
 * GET /api/weekly-streak?lessonId=xxx
 * Get weekly streak challenge for a lesson (student view)
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    const courseId = req.nextUrl.searchParams.get("courseId");

    if (lessonId) {
      const streak = await prisma.weeklyStreak.findUnique({
        where: { lessonId },
        select: { id: true, title: true, description: true, problem: true, weekNumber: true },
      });
      return apiSuccess({ streak });
    }

    if (courseId) {
      // Get user's streak count for this course (auth is optional here)
      const user = extractUser(req);
      const userId = user?.userId || null;

      const streaks = await prisma.weeklyStreak.findMany({
        where: { courseId },
        select: { id: true, title: true, weekNumber: true },
        orderBy: { weekNumber: "asc" },
      });

      let completedCount = 0;
      let attempts: { streakId: string; passed: boolean }[] = [];
      if (userId) {
        attempts = await prisma.weeklyStreakAttempt.findMany({
          where: { userId, passed: true, streakId: { in: streaks.map(s => s.id) } },
          select: { streakId: true, passed: true },
          distinct: ["streakId"],
        });
        completedCount = attempts.length;
      }

      return apiSuccess({
        streaks: streaks.map(s => ({
          ...s,
          completed: attempts.some(a => a.streakId === s.id),
        })),
        completedCount,
        totalStreaks: streaks.length,
      });
    }

    return apiError(400, "lessonId or courseId required.");
  } catch {
    return apiError(500, "Internal server error.");
  }
}

/**
 * POST /api/weekly-streak
 * Submit weekly streak attempt
 * Body: { streakId, answer }
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const { streakId, answer } = await req.json();

    if (!streakId || !answer?.trim()) {
      return apiError(400, "streakId and answer are required.");
    }

    const streak = await prisma.weeklyStreak.findUnique({ where: { id: streakId } });
    if (!streak) return apiError(404, "Streak challenge not found.");

    // Check if user already passed this streak
    const existingPass = await prisma.weeklyStreakAttempt.findFirst({
      where: { userId: user!.userId, streakId, passed: true },
    });
    if (existingPass) {
      return apiSuccess({ passed: true, feedback: "You have already completed this streak challenge!", attemptId: existingPass.id });
    }

    // Evaluate using Gemini AI
    let passed = false;
    let feedback = "Solution submitted.";

    if (isGeminiConfigured()) {
      const prompt = `You are an expert evaluator. Evaluate this student's answer to a weekly coding challenge.

CHALLENGE: ${streak.title}
PROBLEM: ${streak.problem}
EXPECTED SOLUTION: ${streak.solution}

STUDENT'S ANSWER:
${answer}

Respond ONLY with valid JSON (no markdown):
{"passed": true/false, "feedback": "Brief 1-2 sentence feedback"}`;

      const aiResult = await callGeminiJSON<{ passed: boolean; feedback: string }>(prompt, {
        temperature: 0.3,
        maxOutputTokens: 256,
      });

      if (aiResult) {
        passed = !!aiResult.passed;
        feedback = aiResult.feedback || feedback;
      } else {
        // Gemini unavailable — accept submission
        passed = true;
        feedback = "Solution submitted successfully.";
      }
    } else {
      passed = answer.trim().length >= 10;
      feedback = passed ? "Solution accepted." : "Please provide a more detailed answer.";
    }

    // Save attempt
    const attempt = await prisma.weeklyStreakAttempt.create({
      data: {
        userId: user!.userId,
        streakId,
        answer: answer.trim(),
        passed,
        feedback,
      },
    });

    return apiSuccess({ passed, feedback, attemptId: attempt.id });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
