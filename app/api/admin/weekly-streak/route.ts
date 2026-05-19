import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * POST /api/admin/weekly-streak
 * Create a weekly streak challenge for a lesson (7th, 14th, 21st, etc.)
 * Body: { lessonId, moduleId, courseId, title, description, problem, solution, weekNumber }
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, moduleId, courseId, title, description, problem, solution, weekNumber } = await req.json();

    if (!lessonId || !moduleId || !courseId || !title?.trim() || !problem?.trim() || !solution?.trim()) {
      return NextResponse.json(
        { success: false, message: "lessonId, moduleId, courseId, title, problem, and solution are required." },
        { status: 400 }
      );
    }

    // Check if streak already exists for this lesson
    const existing = await prisma.weeklyStreak.findUnique({ where: { lessonId } });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "Weekly streak already exists for this lesson." },
        { status: 409 }
      );
    }

    const streak = await prisma.weeklyStreak.create({
      data: {
        lessonId,
        moduleId,
        courseId,
        title: title.trim(),
        description: description?.trim() || "",
        problem: problem.trim(),
        solution: solution.trim(),
        weekNumber: weekNumber || 1,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Weekly streak challenge created.",
      streak,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/weekly-streak?courseId=xxx
 * Get all weekly streaks for a course (admin view)
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const courseId = req.nextUrl.searchParams.get("courseId");

    const where = courseId ? { courseId } : {};
    const streaks = await prisma.weeklyStreak.findMany({
      where,
      orderBy: { weekNumber: "asc" },
    });

    return NextResponse.json({ success: true, streaks });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
