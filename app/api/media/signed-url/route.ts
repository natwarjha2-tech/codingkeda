import { NextRequest, NextResponse } from "next/server";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";
import { verifyToken } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * POST /api/media/signed-url
 * Generate a temporary signed URL for a private S3 file
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

    verifyToken(token);

    const { url } = await req.json();

    if (!url?.trim()) {
      return NextResponse.json(
        { success: false, message: "URL is required." },
        { status: 400 }
      );
    }

    const s3Key = getS3KeyFromUrl(url);
    if (!s3Key) {
      return NextResponse.json(
        { success: false, message: "Invalid S3 URL." },
        { status: 400 }
      );
    }

    const media = await prisma.media.findUnique({ where: { s3Key, isActive: true } });
    if (!media) {
      return NextResponse.json(
        { success: false, message: "Media not found." },
        { status: 404 }
      );
    }

    const signedUrl = await getSignedFileUrlFromUrl(url, 900); // 15 minutes

    return NextResponse.json({ success: true, signedUrl });
  } catch (err) {
    console.error("Signed URL error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to generate signed URL." },
      { status: 500 }
    );
  }
}
