import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { setParentReportConsent } from "@/app/services/weekly-report.service";
import { getParentVerification } from "@/app/services/parent-verify.service";
import { forgetConsent } from "@/app/services/parent-consent.service";
import { validateName, cleanName } from "@/app/lib/name";
import { dobError } from "@/app/lib/age";
import { isValidEmail } from "@/app/lib/validation";
import { normalizeWhatsAppNumber } from "@/app/lib/whatsapp";

/**
 * PATCH /api/student/profile
 * Update user display name + all student/parent detail fields
 * Requires valid user token
 */
export async function PATCH(req: NextRequest) {
  try {
    const { error, user } = requireAuth(req);
    if (error) return error;

    const body = await req.json();
    const { name, studentName, studentDob, studentGrade, studentGender, studentSchool, parentName, parentEmail, parentContact, parentReportConsent } = body;

    // Check what the student typed before saving anything.
    if (name?.trim()) {
      const problem = validateName(name);
      if (problem) return apiError(400, problem);
    }
    if (typeof studentDob === "string" && studentDob.trim()) {
      const problem = dobError(studentDob);
      if (problem) return apiError(400, problem);
    }
    if (typeof parentEmail === "string" && parentEmail.trim()) {
      if (!isValidEmail(parentEmail)) return apiError(400, "Enter a valid parent email address.");
      if (parentEmail.trim().toLowerCase() === String(user!.email ?? "").trim().toLowerCase()) {
        return apiError(400, "The parent email must be different from your own email.");
      }
    }
    if (typeof parentContact === "string" && parentContact.trim() && !normalizeWhatsAppNumber(parentContact)) {
      return apiError(400, "Enter a valid parent phone number.");
    }

    // Update User display name if provided
    if (name?.trim()) {
      await prisma.user.update({ where: { id: user!.userId }, data: { name: cleanName(name) } });
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
    if (name?.trim()) studentData.name = cleanName(name);

    // Upsert student record
    if (Object.keys(studentData).length > 0) {
      const existingStudent = await prisma.student.findUnique({ where: { userId: user!.userId } });

      if (existingStudent) {
        await prisma.student.update({ where: { userId: user!.userId }, data: studentData });
      } else {
        const dbUser = await prisma.user.findUnique({ where: { id: user!.userId }, select: { email: true, name: true } });
        await prisma.student.create({
          data: { userId: user!.userId, email: dbUser!.email, name: studentData.name ?? dbUser!.name, enrolledCourses: 0, ...studentData },
        });
      }
    }

    // Date of birth or parent details may have changed the parent-check answer.
    forgetConsent(user!.userId);

    // Parent consent for the weekly WhatsApp report (opt-in; only when sent).
    if (typeof parentReportConsent === "boolean") {
      // The report can only be switched ON for a number the parent has verified with a code.
      if (parentReportConsent && !(await getParentVerification(user!.userId)).verified) {
        return apiError(400, "Verify your parent's WhatsApp number first, then turn on the weekly report.");
      }
      await setParentReportConsent(user!.userId, parentReportConsent, "app");
    }

    return apiSuccess({});
  } catch {
    return apiError(500, "Internal server error.");
  }
}
