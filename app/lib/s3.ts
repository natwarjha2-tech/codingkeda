import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME!;

export async function uploadToS3(file: Buffer, key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  });
  await s3.send(command);
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function getSignedFileUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

export function getS3KeyFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const marker = ".amazonaws.com/";
    const index = parsed.href.indexOf(marker);
    if (index === -1) return null;
    // Use pathname only — strip query params (signed URL params)
    return decodeURIComponent(parsed.pathname.substring(1));
  } catch {
    return null;
  }
}

export async function getSignedFileUrlFromUrl(url: string, expiresIn = 3600) {
  const key = getS3KeyFromUrl(url);
  if (!key) throw new Error("Invalid S3 URL.");
  return getSignedFileUrl(key, expiresIn);
}

export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
  const publicUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { uploadUrl, publicUrl };
}

export function getPublicUrl(key: string) {
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}
