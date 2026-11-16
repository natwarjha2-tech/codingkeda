import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { claimDevice, claimErrorResponse, parseDevice } from "@/app/services/student-device.service";
import { cancelDeletionOnSignIn } from "@/app/services/account-deletion.service";
import { cleanName, validateName } from "@/app/lib/name";

/**
 * POST /api/auth/verify-otp
 * Verifies the OTP and logs in the user.
 * If user doesn't exist, creates a new account automatically.
 * Body: { email, otp, name? }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, otp, name, device, replaceDevice } = await req.json();

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

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Device limit (students only). Checked BEFORE the code is used up, so the
    // student can confirm "use this device instead" with the same code.
    const deviceInfo = parseDevice(device);
    let did: string | undefined;
    if (user) {
      // Signing in during the 30-day deletion grace period restores the account.
      await cancelDeletionOnSignIn(user.id);
      const claim = await claimDevice({ id: user.id, role: user.role }, deviceInfo, { replace: replaceDevice === true });
      if (!claim.ok) return claimErrorResponse(claim);
      did = claim.did;
    }

    // Mark OTP as used
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    if (!user) {
      // New user — create account
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          // A typed name is used only when it is a real name; otherwise the email prefix, as before.
          name: typeof name === "string" && cleanName(name) && !validateName(name) ? cleanName(name) : normalizedEmail.split("@")[0],
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

      // A brand-new account has no devices yet, so this only registers the device.
      const claim = await claimDevice({ id: user.id, role: user.role }, deviceInfo);
      did = claim.ok ? claim.did : undefined;
    }

    // Generate JWT (365 days)
    const token = signToken(
      { userId: user.id, email: user.email, role: user.role, ...(did ? { did } : {}) },
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
