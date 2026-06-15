import { NextRequest, NextResponse } from "next/server";
import { s3 } from "@/app/lib/s3";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { requireAdmin } from "@/app/lib/middleware";

export async function POST(req: NextRequest) {
  const { error } = requireAdmin(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { key, expectedSize } = body || {};
    if (!key) return NextResponse.json({ success: false, message: "key is required" }, { status: 400 });

    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }));
      const contentLength = head.ContentLength ?? null;
      const etag = head.ETag ?? null;
      const matches = expectedSize == null ? true : Number(expectedSize) === Number(contentLength);
      return NextResponse.json({ success: true, matches, contentLength, etag });
    } catch (err: any) {
      return NextResponse.json({ success: false, message: "S3 object not found or head failed", detail: err?.message || String(err) }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Invalid request", detail: err?.message || String(err) }, { status: 400 });
  }
}
