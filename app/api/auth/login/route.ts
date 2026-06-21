import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { signToken } from "@/app/lib/auth";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid credentials." },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "Invalid credentials." },
        { status: 401 }
      );
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    // Generate fresh presigned URL if avatar exists (private S3 bucket)
    let avatarUrl: string | null = null;
    if (user.avatarUrl) {
      try {
        const s3Key = getS3KeyFromUrl(user.avatarUrl);
        if (s3Key) {
          avatarUrl = await getSignedFileUrlFromUrl(user.avatarUrl, 86400); // 24h
        } else {
          avatarUrl = user.avatarUrl;
        }
      } catch {
        avatarUrl = null; // avatar fail should not block login
      }
    }

    return NextResponse.json({
      success: true,
      message: `Logged in as ${user.role}.`,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
