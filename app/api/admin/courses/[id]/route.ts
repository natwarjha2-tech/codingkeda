import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * DELETE /api/admin/courses/[id]
 * Permanently delete a course and all its modules, lessons, quizzes, etc.
 * Prisma cascade handles related records automatically.
 * Requires admin authentication + ownership check.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = requireAdmin(req);
    if (error) return error;

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Course ID is required." },
        { status: 400 }
      );
    }

    // Verify course exists and belongs to this admin
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    if (course.createdBy !== user!.userId && user!.role !== "super-admin") {
      return NextResponse.json(
        { success: false, message: "You can only delete your own courses." },
        { status: 403 }
      );
    }

    // Delete course — Prisma cascade will delete modules, lessons, quizzes, etc.
    await prisma.course.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Course deleted permanently.",
    });
  } catch (err) {
    console.error("Delete course error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
