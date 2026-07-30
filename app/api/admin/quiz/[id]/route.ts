import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

/**
 * PUT /api/admin/quiz/[id] — Update a quiz
 * DELETE /api/admin/quiz/[id] — Delete a quiz
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;
    const { id } = await params;
    const { question, options, answer, explanation } = await req.json();

    const updated = await prisma.quiz.update({
      where: { id },
      data: { ...(question && { question }), ...(options && { options }), ...(answer !== undefined && { answer: Number(answer) }), ...(explanation !== undefined && { explanation }) },
    });
    return apiSuccess({ quiz: updated });
  } catch {
    return apiError(500, "Internal server error.");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;
    const { id } = await params;

    await prisma.quiz.delete({ where: { id } });
    return apiSuccess({ message: "Quiz deleted." });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
