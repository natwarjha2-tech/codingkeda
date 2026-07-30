import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { extractUser } from "@/app/lib/middleware";
import { verifyToken } from "@/app/lib/auth";
import { apiSuccess, apiError } from "@/app/lib/response";

// ── GET /api/student — fetch logged-in user profile ──────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { error, user: authUser } = requireAuth(req);
    if (error) return error;

    const user = await prisma.user.findUnique({
      where: { id: authUser!.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) return apiError(404, "User not found.");

    const student = await prisma.student.findUnique({
      where: { userId: authUser!.userId },
      select: {
        id: true, enrolledCourses: true, createdAt: true,
        studentName: true, studentDob: true, studentGrade: true, studentGender: true, studentSchool: true,
        parentName: true, parentEmail: true, parentContact: true,
      },
    });

    const enrollmentCount = await prisma.enrollment.count({ where: { userId: authUser!.userId } });

    return apiSuccess({
      student: student
        ? {
            ...user, studentId: student.id, enrolledCourses: enrollmentCount, enrolledSince: student.createdAt,
            studentName: student.studentName ?? null, studentDob: student.studentDob ?? null,
            studentGrade: student.studentGrade ?? null, studentGender: student.studentGender ?? null,
            studentSchool: student.studentSchool ?? null, parentName: student.parentName ?? null,
            parentEmail: student.parentEmail ?? null, parentContact: student.parentContact ?? null,
          }
        : { ...user, enrolledCourses: enrollmentCount },
      user,
    });
  } catch {
    return apiError(401, "Invalid or expired token.");
  }
}

// ── POST /api/student — create student record (manual registration) ───────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { name, email, phone } = await req.json();

    if (!name?.trim() || !email?.trim()) return apiError(400, "Name and email are required.");
    if (!EMAIL_RE.test(email.trim())) return apiError(400, "Invalid email format.");

    // If authenticated, link to user
    let userId: string | undefined;
    if (token) {
      try { userId = verifyToken(token).userId; } catch {}
    }

    if (userId) {
      const student = await prisma.student.upsert({
        where: { userId },
        update: { name: name.trim(), phone: phone?.trim() ?? null },
        create: { userId, name: name.trim(), email: email.trim().toLowerCase(), phone: phone?.trim() ?? null, enrolledCourses: 0 },
      });
      return apiSuccess({ message: "Student created.", student }, 201);
    }

    // Fallback: find user by email and link
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) return apiError(400, "No registered user found with this email. Please sign up first.");

    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: { name: name.trim(), phone: phone?.trim() ?? null },
      create: { userId: user.id, name: name.trim(), email: user.email, phone: phone?.trim() ?? null, enrolledCourses: 0 },
    });

    return apiSuccess({ message: "Student created.", student }, 201);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return apiError(409, "Student record already exists.");
    }
    return apiError(500, "Internal server error.");
  }
}
