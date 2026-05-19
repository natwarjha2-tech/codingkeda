import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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
      return NextResponse.json({ success: true, streak });
    }

    if (courseId) {
      // Get user's streak count for this course
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "");
      let userId: string | null = null;
      if (token) {
        try { userId = verifyToken(token).userId; } catch {}
      }

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

      return NextResponse.json({
        success: true,
        streaks: streaks.map(s => ({
          ...s,
          completed: attempts.some(a => a.streakId === s.id),
        })),
        completedCount,
        totalStreaks: streaks.length,
      });
    }

    return NextResponse.json({ success: false, message: "lessonId or courseId required." }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

/**
 * POST /api/weekly-streak
 * Submit weekly streak attempt
 * Body: { streakId, answer }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const payload = verifyToken(token);
    const { streakId, answer } = await req.json();

    if (!streakId || !answer?.trim()) {
      return NextResponse.json({ success: false, message: "streakId and answer are required." }, { status: 400 });
    }

    const streak = await prisma.weeklyStreak.findUnique({ where: { id: streakId } });
    if (!streak) {
      return NextResponse.json({ success: false, message: "Streak challenge not found." }, { status: 404 });
    }

    // Check if user already passed this streak
    const existingPass = await prisma.weeklyStreakAttempt.findFirst({
      where: { userId: payload.userId, streakId, passed: true },
    });
    if (existingPass) {
      return NextResponse.json({
        success: true,
        passed: true,
        feedback: "You have already completed this streak challenge!",
        attemptId: existingPass.id,
      });
    }

    // Evaluate using Gemini AI
    let passed = false;
    let feedback = "Solution submitted.";

    if (GEMINI_API_KEY) {
      try {
        const prompt = `You are an expert evaluator. Evaluate this student's answer to a weekly coding challenge.

CHALLENGE: ${streak.title}
PROBLEM: ${streak.problem}
EXPECTED SOLUTION: ${streak.solution}

STUDENT'S ANSWER:
${answer}

Respond ONLY with valid JSON (no markdown):
{"passed": true/false, "feedback": "Brief 1-2 sentence feedback"}`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          try {
            const aiResult = JSON.parse(cleaned);
            passed = !!aiResult.passed;
            feedback = aiResult.feedback || feedback;
          } catch {
            passed = rawText.toLowerCase().includes('"passed": true') || rawText.toLowerCase().includes('"passed":true');
          }
        } else {
          passed = true;
          feedback = "Solution submitted successfully.";
        }
      } catch {
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
        userId: payload.userId,
        streakId,
        answer: answer.trim(),
        passed,
        feedback,
      },
    });

    return NextResponse.json({
      success: true,
      passed,
      feedback,
      attemptId: attempt.id,
    });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
