import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * DELETE /api/admin/modules/[id]
 * Permanently delete a module and all its lessons (cascade).
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
        { success: false, message: "Module ID is required." },
        { status: 400 }
      );
    }

    // Verify module exists
    const module = await prisma.module.findUnique({ where: { id } });
    if (!module) {
      return NextResponse.json(
        { success: false, message: "Module not found." },
        { status: 404 }
      );
    }

    // Delete module — cascade deletes all lessons, quizzes, exercises inside
    await prisma.module.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Module deleted permanently.",
    });
  } catch (err) {
    console.error("Delete module error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
