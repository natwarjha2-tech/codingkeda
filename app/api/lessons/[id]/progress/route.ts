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

    await prisma.progress.upsert({
      where: { userId_lessonId: { userId: user!.userId, lessonId } },
      update: { completed },
      create: { userId: user!.userId, lessonId, completed },
    });

    return apiSuccess({ message: completed ? "Lesson marked complete." : "Lesson marked incomplete." });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
