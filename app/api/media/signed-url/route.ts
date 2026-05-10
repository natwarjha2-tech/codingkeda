import { NextRequest, NextResponse } from "next/server";
import { getSignedFileUrl } from "@/app/lib/s3";
import { verifyToken } from "@/app/lib/auth";

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

    // Extract S3 key from full S3 URL
    // e.g. https://bucket.s3.region.amazonaws.com/media/file.pdf → media/file.pdf
    const s3Key = url.split(".amazonaws.com/").pop();

    if (!s3Key) {
      return NextResponse.json(
        { success: false, message: "Invalid S3 URL." },
        { status: 400 }
      );
    }

    const signedUrl = await getSignedFileUrl(s3Key, 900); // 15 minutes

    return NextResponse.json({ success: true, signedUrl });
  } catch {
    return NextResponse.json(
      { success: false, message: "Failed to generate signed URL." },
      { status: 500 }
    );
  }
}
