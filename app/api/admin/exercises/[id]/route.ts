import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

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

    return apiSuccess({ exercise: updated });
  } catch {
    return apiError(500, "Internal server error.");
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

    return apiSuccess({ message: "Exercise deleted." });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
