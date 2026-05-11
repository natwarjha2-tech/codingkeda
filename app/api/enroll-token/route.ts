import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { randomBytes } from "crypto";

/**
 * POST /api/enroll-token
 * Generate a one-time enrollment token after payment
 * Requires valid user token
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const { courseId } = await req.json();

    if (!courseId?.trim()) {
      return NextResponse.json(
        { success: false, message: "courseId is required." },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 }
      );
    }

    // Generate secure one-time token
    const enrollToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.enrollToken.create({
      data: {
        token: enrollToken,
        userId: payload.userId,
        courseId,
        expiresAt,
      },
    });

    return NextResponse.json({ success: true, enrollToken });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/enroll-token?token=xxx
 * Verify and consume enrollment token — enroll user in course
 * No auth required — token itself is the proof
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token is required." },
        { status: 400 }
      );
    }

    const record = await prisma.enrollToken.findUnique({ where: { token } });

    if (!record) {
      return NextResponse.json(
        { success: false, message: "Invalid token." },
        { status: 400 }
      );
    }

    if (record.used) {
      return NextResponse.json(
        { success: false, message: "Token already used." },
        { status: 400 }
      );
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { success: false, message: "Token expired." },
        { status: 400 }
      );
    }

    // Mark token as used
    await prisma.enrollToken.update({
      where: { token },
      data: { used: true },
    });

    // Enroll user in course
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: record.userId, courseId: record.courseId } },
      update: {},
      create: { userId: record.userId, courseId: record.courseId },
    });

    return NextResponse.json({
      success: true,
      message: "Enrolled successfully.",
      courseId: record.courseId,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
