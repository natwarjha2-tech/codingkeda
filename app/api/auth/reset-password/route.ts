import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/reset-password
 * Reset password using token
 * Body: { token, password }
 */
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token?.trim() || !password?.trim()) {
      return NextResponse.json(
        { success: false, message: "Token and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Find reset record
    const resetRecord = await prisma.passwordReset.findUnique({ where: { token } });

    if (!resetRecord) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset link." },
        { status: 400 }
      );
    }

    if (resetRecord.used) {
      return NextResponse.json(
        { success: false, message: "This reset link has already been used." },
        { status: 400 }
      );
    }

    if (new Date() > resetRecord.expiresAt) {
      return NextResponse.json(
        { success: false, message: "Reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await prisma.user.update({
      where: { email: resetRecord.email },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await prisma.passwordReset.update({
      where: { token },
      data: { used: true },
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
