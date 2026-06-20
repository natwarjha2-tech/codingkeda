import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * PATCH /api/student/profile
 * Update user display name + all student/parent detail fields
 * Requires valid user token
 */
export async function PATCH(req: NextRequest) {
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
    const body = await req.json();

    const {
      name,
      studentName,
      studentDob,
      studentGrade,
      studentGender,
      studentSchool,
      parentName,
      parentEmail,
      parentContact,
    } = body;

    // Update User display name if provided
    if (name?.trim()) {
      await prisma.user.update({
        where: { id: payload.userId },
        data: { name: name.trim() },
      });
    }

    // Build student update data — only include fields that were sent
    const studentData: Record<string, string | null> = {};
    if (studentName !== undefined) studentData.studentName = studentName?.trim() || null;
    if (studentDob !== undefined) studentData.studentDob = studentDob?.trim() || null;
    if (studentGrade !== undefined) studentData.studentGrade = studentGrade?.trim() || null;
    if (studentGender !== undefined) studentData.studentGender = studentGender?.trim() || null;
    if (studentSchool !== undefined) studentData.studentSchool = studentSchool?.trim() || null;
    if (parentName !== undefined) studentData.parentName = parentName?.trim() || null;
    if (parentEmail !== undefined) studentData.parentEmail = parentEmail?.trim() || null;
    if (parentContact !== undefined) studentData.parentContact = parentContact?.trim() || null;
    if (name?.trim()) studentData.name = name.trim();

    // Upsert student record — create if not exists, update if exists
    if (Object.keys(studentData).length > 0) {
      const existingStudent = await prisma.student.findUnique({
        where: { userId: payload.userId },
      });

      if (existingStudent) {
        await prisma.student.update({
          where: { userId: payload.userId },
          data: studentData,
        });
      } else {
        // Get user email for student creation
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { email: true, name: true },
        });
        await prisma.student.create({
          data: {
            userId: payload.userId,
            email: user!.email,
            name: studentData.name ?? user!.name,
            enrolledCourses: 0,
            ...studentData,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
