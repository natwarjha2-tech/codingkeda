import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * POST /api/admin/homework
 * Create a homework problem for a lesson
 * Body: { lessonId, title, description, difficulty }
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { lessonId, title, description, difficulty } = await req.json();

    if (!lessonId?.trim() || !title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { success: false, message: "lessonId, title, and description are required." },
        { status: 400 }
      );
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return NextResponse.json(
        { success: false, message: "Lesson not found." },
        { status: 404 }
      );
    }

    // Auto-assign order
    const lastHomework = await prisma.homework.findFirst({
      where: { lessonId },
      orderBy: { order: "desc" },
    });
    const nextOrder = (lastHomework?.order ?? 0) + 1;

    const homework = await prisma.homework.create({
      data: {
        lessonId: lessonId.trim(),
        title: title.trim(),
        description: description.trim(),
        difficulty: difficulty?.trim() || "medium",
        order: nextOrder,
      },
    });

    return NextResponse.json(
      { success: true, message: "Homework created successfully.", homework },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
