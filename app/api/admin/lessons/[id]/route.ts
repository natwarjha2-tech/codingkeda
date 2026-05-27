import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * DELETE /api/admin/lessons/[id]
 * Permanently delete a lesson and all its quizzes, exercises, progress (cascade).
 * Requires admin authentication.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Lesson ID is required." },
        { status: 400 }
      );
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) {
      return NextResponse.json(
        { success: false, message: "Lesson not found." },
        { status: 404 }
      );
    }

    // Delete lesson — cascade deletes quizzes, exercises, progress
    await prisma.lesson.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Lesson deleted permanently.",
    });
  } catch (err) {
    console.error("Delete lesson error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
