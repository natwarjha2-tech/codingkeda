import { NextRequest } from "next/server";
import { s3 } from "@/app/lib/s3";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { requireAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";

export async function POST(req: NextRequest) {
  const { error } = requireAdmin(req);
  if (error) return error;

  try {
    const { key, expectedSize } = await req.json();
    if (!key) return apiError(400, "key is required");

    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }));
      const contentLength = head.ContentLength ?? null;
      const etag = head.ETag ?? null;
      const matches = expectedSize == null ? true : Number(expectedSize) === Number(contentLength);
      return apiSuccess({ matches, contentLength, etag });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return apiError(404, "S3 object not found: " + msg);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(400, "Invalid request: " + msg);
  }
}
