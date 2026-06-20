import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

// ── GET /api/student — fetch logged-in user profile ──────────────────────────
export async function GET(req: NextRequest) {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    // Also fetch student record if exists
    const student = await prisma.student.findUnique({
      where: { userId: payload.userId },
      select: {
        id: true,
        enrolledCourses: true,
        createdAt: true,
        studentName: true,
        studentDob: true,
        studentGrade: true,
        studentGender: true,
        studentSchool: true,
        parentName: true,
        parentEmail: true,
        parentContact: true,
      },
    });

    // Get actual enrollment count (always accurate)
    const enrollmentCount = await prisma.enrollment.count({
      where: { userId: payload.userId },
    });

    return NextResponse.json({
      success: true,
      student: student
        ? {
            ...user,
            studentId: student.id,
            enrolledCourses: enrollmentCount,
            enrolledSince: student.createdAt,
            studentName: student.studentName ?? null,
            studentDob: student.studentDob ?? null,
            studentGrade: student.studentGrade ?? null,
            studentGender: student.studentGender ?? null,
            studentSchool: student.studentSchool ?? null,
            parentName: student.parentName ?? null,
            parentEmail: student.parentEmail ?? null,
            parentContact: student.parentContact ?? null,
          }
        : { ...user, enrolledCourses: enrollmentCount },
      user,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid or expired token." },
      { status: 401 }
    );
  }
}

// ── POST /api/student — create student record (manual registration) ───────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    const { name, email, phone } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { success: false, message: "Name and email are required." },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email.trim())) {
      return NextResponse.json(
        { success: false, message: "Invalid email format." },
        { status: 400 }
      );
    }

    // If authenticated, link to user
    let userId: string | undefined;
    if (token) {
      try {
        const payload = verifyToken(token);
        userId = payload.userId;
      } catch {
        // Invalid token — continue without linking
      }
    }

    // If userId available, use upsert to avoid duplicates
    if (userId) {
      const student = await prisma.student.upsert({
        where: { userId },
        update: {
          name: name.trim(),
          phone: phone?.trim() ?? null,
        },
        create: {
          userId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() ?? null,
          enrolledCourses: 0,
        },
      });

      return NextResponse.json(
        { success: true, message: "Student created.", student },
        { status: 201 }
      );
    }

    // Fallback: find user by email and link
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "No registered user found with this email. Please sign up first." },
        { status: 400 }
      );
    }

    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        name: name.trim(),
        phone: phone?.trim() ?? null,
      },
      create: {
        userId: user.id,
        name: name.trim(),
        email: user.email,
        phone: phone?.trim() ?? null,
        enrolledCourses: 0,
      },
    });

    return NextResponse.json(
      { success: true, message: "Student created.", student },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "Student record already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
