import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendEmail } from "@/app/lib/mail";

/**
 * POST /api/auth/send-otp
 * Sends a 6-digit OTP to the given email address.
 * Works for both new users (signup) and existing users (login).
 * OTP expires in 5 minutes.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, message: "Valid email is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete any previous unused OTPs for this email
    await prisma.emailOtp.deleteMany({
      where: { email: normalizedEmail, used: false },
    });

    // Save OTP
    await prisma.emailOtp.create({
      data: { email: normalizedEmail, otp, expiresAt },
    });

    // Send email
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:450px;margin:0 auto;background:#0f0f1a;color:#e2e8f0;padding:32px;border-radius:16px;">
        <h2 style="color:#a78bfa;margin-bottom:8px;text-align:center;">Your Login Code</h2>
        <p style="color:#94a3b8;text-align:center;margin-bottom:24px;">Enter this code to log in to CodingKida</p>
        <div style="background:#16213e;border:2px solid #6c47ff;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
          <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#fff;">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:12px;text-align:center;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
        <p style="color:#475569;font-size:12px;text-align:center;margin-top:16px;">— CodingKida Team</p>
      </div>`;

    await sendEmail(normalizedEmail, "Your CodingKida Login Code", html);

    return NextResponse.json({
      success: true,
      message: "OTP sent to your email.",
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
