import { NextRequest, NextResponse } from "next/server";
import { getSignedFileUrlFromUrl, getS3KeyFromUrl } from "@/app/lib/s3";
import { verifyToken } from "@/app/lib/auth";

/**
 * POST /api/media/signed-url
 * Generate a temporary signed URL for a private S3 file
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      try { verifyToken(token); } catch { /* expired or invalid — continue */ }
    }

    const { url, forDownload } = await req.json();

    if (!url?.trim()) {
      console.error('[signed-url] Missing URL in request body');
      return NextResponse.json(
        { success: false, message: "URL is required." },
        { status: 400 }
      );
    }

    const s3Key = getS3KeyFromUrl(url);
    if (!s3Key) {
      console.log('[signed-url] Non-S3 URL, returning as-is:', url.substring(0, 80));
      return NextResponse.json({ success: true, signedUrl: url });
    }

    const ttl = forDownload ? 7200 : 900;
    console.log('[signed-url] Signing key:', s3Key, '| TTL:', ttl, '| forDownload:', !!forDownload);
    const signedUrl = await getSignedFileUrlFromUrl(url, ttl);
    console.log('[signed-url] Success, expires in', ttl, 'seconds');

    return NextResponse.json({ success: true, signedUrl });
  } catch (err) {
    console.error('[signed-url] FAILED:', err);
    return NextResponse.json(
      { success: false, message: "Failed to generate signed URL." },
      { status: 500 }
    );
  }
}
