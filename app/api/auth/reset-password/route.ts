import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { apiSuccess, apiError } from "@/app/lib/response";
import { validatePassword } from "@/app/lib/validation";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/reset-password
 * Reset password using token
 * Body: { token, password }
 */
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token?.trim() || !password?.trim()) return apiError(400, "Token and password are required.");
    const passwordError = validatePassword(password);
    if (passwordError) return apiError(400, passwordError);

    const resetRecord = await prisma.passwordReset.findUnique({ where: { token } });
    if (!resetRecord) return apiError(400, "Invalid or expired reset link.");
    if (resetRecord.used) return apiError(400, "This reset link has already been used.");
    if (new Date() > resetRecord.expiresAt) return apiError(400, "Reset link has expired. Please request a new one.");

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { email: resetRecord.email }, data: { password: hashedPassword } });
    await prisma.passwordReset.update({ where: { token }, data: { used: true } });

    return apiSuccess({ message: "Password reset successfully. You can now login with your new password." });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
