import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params;
    const { completed = true } = await req.json();
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    console.log('[lessons/progress] lessonId:', lessonId, '| completed:', completed);
    if (!token) {
      console.warn('[lessons/progress] No token provided');
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }
    const payload = verifyToken(token);
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      console.warn('[lessons/progress] Lesson not found:', lessonId);
      return NextResponse.json(
        { success: false, message: "Lesson not found." },
        { status: 404 }
      );
    }
    await prisma.progress.upsert({
      where: { userId_lessonId: { userId: payload.userId, lessonId } },
      update: { completed },
      create: { userId: payload.userId, lessonId, completed },
    });
    console.log('[lessons/progress] Success userId:', payload.userId, 'lessonId:', lessonId);
    return NextResponse.json({
      success: true,
      message: completed ? "Lesson marked complete." : "Lesson marked incomplete.",
    });
  } catch (err) {
    console.error('[lessons/progress] FAILED:', err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
