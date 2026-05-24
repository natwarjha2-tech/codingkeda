import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { syncStudentOnEnroll } from "@/app/lib/sync-student";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    // Upsert — safe to call multiple times
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: payload.userId, courseId } },
      update: {},
      create: { userId: payload.userId, courseId },
    });

    // Sync Student record
    await syncStudentOnEnroll(payload.userId);

    return NextResponse.json({
      success: true,
      message: "Enrolled successfully.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
