import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";

/**
 * POST /api/auth/verify-otp
 * Verifies the OTP and logs in the user.
 * If user doesn't exist, creates a new account automatically.
 * Body: { email, otp, name? }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, otp, name } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, message: "Email and OTP are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find valid OTP
    const otpRecord = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        otp: otp.trim(),
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired OTP. Please try again." },
        { status: 401 }
      );
    }

    // Mark OTP as used
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // New user — create account
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name?.trim() || normalizedEmail.split("@")[0],
          password: "", // no password for OTP users
          role: "user",
        },
      });

      // Create student record
      await prisma.student.create({
        data: {
          userId: user.id,
          name: user.name,
          email: user.email,
          enrolledCourses: 0,
        },
      }).catch(() => {}); // ignore if exists
    }

    // Generate JWT (365 days)
    const token = signToken(
      { userId: user.id, email: user.email, role: user.role },
      "365d"
    );

    return NextResponse.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      isNewUser: !user.createdAt || (Date.now() - new Date(user.createdAt).getTime() < 5000),
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
