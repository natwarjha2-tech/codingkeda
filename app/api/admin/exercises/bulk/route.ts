import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

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
      return apiError(400, "lessonId and exercises array required.");
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
          bestSolution: ex.type === "coding" && ex.bestSolution ? ex.bestSolution : undefined,
          inputFormat: ex.inputFormat || null,
          outputFormat: ex.outputFormat || null,
          constraints: ex.constraints || null,
          explanation: ex.explanation || null,
          tags: ex.tags || undefined,
          timeComplexity: ex.timeComplexity || null,
          spaceComplexity: ex.spaceComplexity || null,
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
      }

      created.push(exercise);
    }

    return apiSuccess({
      count: created.length,
      message: `${created.length} exercise(s) added.`,
    });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
