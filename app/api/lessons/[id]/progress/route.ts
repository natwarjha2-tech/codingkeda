import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params;
    const { completed = true } = await req.json();

    const { error, user } = requireAuth(req);
    if (error) return error;

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return apiError(404, "Lesson not found.");

    const where = { userId_lessonId: { userId: user!.userId, lessonId } };
    const existing = await prisma.progress.findUnique({ where, select: { completedAt: true } });
    const now = new Date();
    await prisma.progress.upsert({
      where,
      // Keep the FIRST completion time; re-marking or re-watching never moves it.
      update: { completed, ...(completed && !existing?.completedAt ? { completedAt: now } : {}) },
      create: { userId: user!.userId, lessonId, completed, completedAt: completed ? now : null },
    });

    return apiSuccess({ message: completed ? "Lesson marked complete." : "Lesson marked incomplete." });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
