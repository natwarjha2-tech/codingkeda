import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * POST /api/admin/exercises/bulk
 * Bulk save multiple exercises + test cases to a lesson.
 * Body: { lessonId, exercises: [{ title, description, difficulty, type, language?, solution?, testCases?: [{input, expectedOutput, isHidden}] }] }
 * 
 * If type=coding → auto-triggers AI best solution generation for each.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, exercises } = await req.json();

    if (!lessonId || !exercises || !Array.isArray(exercises) || exercises.length === 0) {
      return NextResponse.json(
        { success: false, message: "lessonId and exercises array required." },
        { status: 400 }
      );
    }

    // Get current max order
    const lastEx = await prisma.exercise.findFirst({
      where: { lessonId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    let startOrder = (lastEx?.order ?? 0) + 1;

    const created = [];
    for (const ex of exercises) {
      if (!ex.title || !ex.description || !ex.type) continue;

      const exercise = await prisma.exercise.create({
        data: {
          lessonId,
          title: ex.title,
          description: ex.description,
          difficulty: ex.difficulty || "medium",
          type: ex.type,
          language: ex.type === "coding" ? (ex.language || "c") : null,
          solution: ex.type === "theory" ? (ex.solution || null) : null,
          order: startOrder++,
        },
      });

      // Create test cases for coding exercises
      if (ex.type === "coding" && ex.testCases && Array.isArray(ex.testCases)) {
        for (let i = 0; i < ex.testCases.length; i++) {
          const tc = ex.testCases[i];
          if (!tc.input && !tc.expectedOutput) continue;
          await prisma.testCase.create({
            data: {
              exerciseId: exercise.id,
              input: tc.input || "",
              expectedOutput: tc.expectedOutput || "",
              isHidden: !!tc.isHidden,
              order: i + 1,
            },
          });
        }

        // Auto-trigger AI best solution generation (non-blocking)
        triggerAISolution(exercise.id).catch(() => {});
      }

      created.push(exercise);
    }

    return NextResponse.json({
      success: true,
      count: created.length,
      message: `${created.length} exercise(s) added.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

async function triggerAISolution(exerciseId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
  await fetch(`${baseUrl}/api/coding-problems/best-solution`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId: exerciseId }),
  }).catch(() => {});
}
