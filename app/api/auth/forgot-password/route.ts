import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendEmail } from "@/app/lib/mail";
import { randomBytes } from "crypto";

/**
 * POST /api/auth/forgot-password
 * Send password reset link to user's email
 * Body: { email }
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, message: "Email is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      return NextResponse.json({
        success: true,
        message: "If this email is registered, you will receive a reset link shortly.",
      });
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save to DB
    await prisma.passwordReset.create({
      data: { email: normalizedEmail, token, expiresAt },
    });

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.codingkida.com";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f0f1a;color:#e2e8f0;padding:32px;border-radius:16px;">
        <h2 style="color:#a78bfa;margin-bottom:8px;">Password Reset</h2>
        <p style="color:#94a3b8;margin-bottom:24px;">You requested a password reset for your CodingKeda account.</p>
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">
          Reset Password
        </a>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
        <p style="color:#475569;font-size:12px;margin-top:16px;">— CodingKeda Team</p>
      </div>
    `;

    await sendEmail(normalizedEmail, "Reset Your Password — CodingKeda", html);

    return NextResponse.json({
      success: true,
      message: "If this email is registered, you will receive a reset link shortly.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
