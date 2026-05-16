import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { uploadToS3, getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";

/**
 * POST /api/student/avatar
 * Upload avatar image to S3 and save URL in DB
 * Requires valid user token
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "File must be an image." },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "Image must be less than 2MB." },
        { status: 400 }
      );
    }

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `avatars/${payload.userId}-${Date.now()}.${file.type.split("/")[1]}`;
    const s3Url = await uploadToS3(buffer, key, file.type);

    // Save URL in DB
    await prisma.user.update({
      where: { id: payload.userId },
      data: { avatarUrl: s3Url },
    });

    // Return presigned URL for immediate display
    const signedUrl = await getSignedFileUrlFromUrl(s3Url, 86400); // 24 hours

    return NextResponse.json({
      success: true,
      avatarUrl: signedUrl,
    });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to upload avatar. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/student/avatar
 * Get current user's avatar as a presigned URL
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { avatarUrl: true },
    });

    if (!user?.avatarUrl) {
      return NextResponse.json({ success: true, avatarUrl: null });
    }

    // Generate presigned URL for private S3 bucket
    const s3Key = getS3KeyFromUrl(user.avatarUrl);
    if (s3Key) {
      const signedUrl = await getSignedFileUrlFromUrl(user.avatarUrl, 86400); // 24 hours
      return NextResponse.json({ success: true, avatarUrl: signedUrl });
    }

    return NextResponse.json({ success: true, avatarUrl: user.avatarUrl });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
