import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/change-password
 * Change password for logged-in user
 * Body: { currentPassword, newPassword }
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user: authUser } = requireAuth(req);
    if (error) return error;

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword?.trim() || !newPassword?.trim()) return apiError(400, "Current password and new password are required.");
    if (newPassword.length < 8) return apiError(400, "New password must be at least 8 characters.");

    const user = await prisma.user.findUnique({ where: { id: authUser!.userId } });
    if (!user) return apiError(404, "User not found.");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return apiError(401, "Current password is incorrect.");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: authUser!.userId }, data: { password: hashedPassword } });

    return apiSuccess({ message: "Password changed successfully." });
  } catch {
    return apiError(500, "Internal server error.");
  }
}
