import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/homework?lessonId=xxx
 * Get all homework problems for a lesson (student-facing, no auth required for reading)
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");

    if (!lessonId) {
      return NextResponse.json(
        { success: false, message: "lessonId is required." },
        { status: 400 }
      );
    }

    const homeworks = await prisma.homework.findMany({
      where: { lessonId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        order: true,
      },
    });

    return NextResponse.json({ success: true, homeworks });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
