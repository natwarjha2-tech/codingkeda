import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/middleware";

/**
 * PUT /api/admin/quiz/[id] — Update a quiz
 * DELETE /api/admin/quiz/[id] — Delete a quiz
 * GET /api/admin/quiz/[id] — not used (use GET /api/admin/quiz?lessonId=xxx)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;
    const { id } = await params;
    const { question, options, answer, explanation } = await req.json();

    const updated = await prisma.quiz.update({
      where: { id },
      data: {
        ...(question && { question }),
        ...(options && { options }),
        ...(answer !== undefined && { answer: Number(answer) }),
        ...(explanation !== undefined && { explanation }),
      },
    });

    return NextResponse.json({ success: true, quiz: updated });
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

    await prisma.quiz.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Quiz deleted." });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
