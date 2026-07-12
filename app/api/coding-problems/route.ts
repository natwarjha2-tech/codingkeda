import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/coding-problems
 * Returns coding practice problems from DB.
 * No auth required — problems are public.
 */
export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category") || "all";
    const difficulty = req.nextUrl.searchParams.get("difficulty") || "all";

    const problems = await fetchFromDB(category, difficulty);

    if (!problems || problems.length === 0) {
      return NextResponse.json({
        success: true,
        problems: [],
        total: 0,
        categories: CATEGORIES,
      });
    }

    return NextResponse.json({
      success: true,
      problems,
      total: problems.length,
      categories: CATEGORIES,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

const CATEGORIES = [
  "Arrays",
  "Strings",
  "Math",
  "Sorting",
  "Searching",
  "Recursion",
  "Linked List",
  "Stack & Queue",
  "Trees",
  "Dynamic Programming",
];

/**
 * Fetch problems from DB (Coding Practice lesson's exercises)
 */
async function fetchFromDB(category: string, difficulty: string) {
  try {
    const lesson = await prisma.lesson.findFirst({
      where: { title: "Coding Practice Problems" },
      select: { id: true },
    });
    if (!lesson) return null;

    const where: any = { lessonId: lesson.id, type: "coding" };
    if (difficulty !== "all") where.difficulty = difficulty;

    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: { order: "asc" },
      include: { testCases: { orderBy: { order: "asc" } } },
    });

    if (exercises.length === 0) return null;

    // Transform to match expected response format
    const problems = exercises.map((ex) => {
      const meta = ex.solution ? (() => { try { return JSON.parse(ex.solution); } catch { return {}; } })() : {};
      const starterCode = ex.starterCode ? (() => { try { return JSON.parse(ex.starterCode); } catch { return {}; } })() : {};

      // Filter by category if needed
      if (category !== "all" && meta.category !== category) return null;

      return {
        id: ex.id,
        title: ex.title,
        description: ex.description,
        inputFormat: meta.inputFormat || "",
        outputFormat: meta.outputFormat || "",
        explanation: meta.explanation || "",
        category: meta.category || "Arrays",
        difficulty: ex.difficulty,
        defaultLanguage: ex.language || "c",
        constraints: meta.constraints || "",
        timeComplexity: meta.timeComplexity || "",
        spaceComplexity: meta.spaceComplexity || "",
        starterCode: starterCode,
        testCases: ex.testCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
        })),
        hints: (ex.hints as string[]) || [],
        tags: meta.tags || [],
      };
    }).filter(Boolean);

    return problems.length > 0 ? problems : null;
  } catch {
    return null;
  }
}
