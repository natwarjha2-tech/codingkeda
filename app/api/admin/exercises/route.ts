import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * POST /api/admin/exercises — Add single exercise
 * GET /api/admin/exercises?lessonId=xxx — List exercises for edit UI
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) {
      return NextResponse.json({ success: false, message: "lessonId required." }, { status: 400 });
    }

    const exercises = await prisma.exercise.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
      include: { testCases: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ success: true, exercises });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, title, description, difficulty, type, language } =
      await req.json();

    if (!lessonId || !title || !description || !type) {
      return NextResponse.json(
        { success: false, message: "lessonId, title, description, and type are required." },
        { status: 400 }
      );
    }

    const exercise = await prisma.exercise.create({
      data: {
        lessonId,
        title,
        description,
        difficulty: difficulty || "medium",
        type,
        language: type === "coding" ? (language || "c") : null,
        order: 0,
      },
    });

    // If type = coding → auto-trigger best solution generation (non-blocking)
    if (type === "coding") {
      triggerBestSolutionGeneration(exercise.id, title, description).catch(
        () => {}
      );
    }

    return NextResponse.json({ success: true, exercise });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * Auto-trigger AI best solution generation for coding exercises
 */
async function triggerBestSolutionGeneration(
  exerciseId: string,
  title: string,
  description: string
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    "http://localhost:3000";

  await fetch(`${baseUrl}/api/coding-problems/best-solution`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId: exerciseId }),
  });
}
