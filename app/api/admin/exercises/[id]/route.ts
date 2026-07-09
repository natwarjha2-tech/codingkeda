import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * PUT /api/admin/exercises/[id] — Update an exercise
 * DELETE /api/admin/exercises/[id] — Delete an exercise + its test cases
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;
    const { id } = await params;
    const { title, description, difficulty, type, language, solution } =
      await req.json();

    const updated = await prisma.exercise.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(difficulty && { difficulty }),
        ...(type && { type }),
        ...(language !== undefined && { language }),
        ...(solution !== undefined && { solution }),
      },
    });

    return NextResponse.json({ success: true, exercise: updated });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;
    const { id } = await params;

    // Delete test cases first (cascade should handle but be explicit)
    await prisma.testCase.deleteMany({ where: { exerciseId: id } });
    await prisma.exercise.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Exercise deleted." });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
