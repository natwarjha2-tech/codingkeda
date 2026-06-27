import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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

// Upload a text/playlist file (m3u8) or binary segment (.ts) to S3
export async function uploadHlsFile(
  content: Buffer | string,
  key: string,
  contentType: string
) {
  const body = typeof content === "string" ? Buffer.from(content) : content;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    // HLS assets are public — segments are useless without the signed master URL
    // and CloudFront can add auth layer on top if needed
  });
  await s3.send(command);
  return getPublicUrl(key);
}

// CloudFront base URL (optional — falls back to S3 direct if not set)
const CF_DOMAIN = process.env.CLOUDFRONT_DOMAIN; // e.g. "d1234.cloudfront.net"

export function getHlsUrl(s3Key: string): string {
  if (CF_DOMAIN) {
    return `https://${CF_DOMAIN}/${s3Key}`;
  }
  return getPublicUrl(s3Key);
}

// Sign a CloudFront URL using signed cookies is complex — for now we sign the S3 key
// In production replace this with CloudFront signed URL via @aws-sdk/cloudfront-signer
export async function getSignedHlsUrl(s3Key: string, expiresIn = 3600): Promise<string> {
  // If CloudFront domain is set but no CF signing keys configured, return signed S3 URL
  return getSignedFileUrl(s3Key, expiresIn);
}


/**
 * Delete a single object from S3 by key.
 * Fails silently — logs error but doesn't throw.
 */
export async function deleteFromS3(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
    await s3.send(command);
    console.log(`S3 deleted: ${key}`);
    return true;
  } catch (err) {
    console.error(`S3 delete failed for key: ${key}`, err);
    return false;
  }
}

/**
 * Delete all objects under an S3 prefix (folder).
 * Used to remove quality MP4s, HLS segments, etc.
 * Fails silently — logs error but doesn't throw.
 */
export async function deleteS3Prefix(prefix: string): Promise<boolean> {
  try {
    // List all objects under this prefix
    const listCommand = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix });
    const listResult = await s3.send(listCommand);

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return true; // Nothing to delete
    }

    // Delete in batches of 1000 (S3 limit)
    const objects = listResult.Contents.map((obj) => ({ Key: obj.Key }));
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: objects },
    });
    await s3.send(deleteCommand);
    console.log(`S3 prefix deleted: ${prefix} (${objects.length} objects)`);
    return true;
  } catch (err) {
    console.error(`S3 prefix delete failed for: ${prefix}`, err);
    return false;
  }
}

/**
 * Delete all S3 files associated with a lesson (video, notes/PDF, quality MP4s, HLS assets).
 */
export async function deleteLessonS3Files(videoUrl: string, notesUrl: string): Promise<void> {
  // Delete main video
  if (videoUrl) {
    const videoKey = getS3KeyFromUrl(videoUrl);
    if (videoKey) {
      await deleteFromS3(videoKey);

      // Delete quality MP4s: stored under qualities/<mediaId>/
      // Video key is typically: videos/<mediaId>/<filename>.mp4
      const parts = videoKey.split("/");
      if (parts.length >= 2) {
        // Extract the mediaId folder (second segment usually)
        // Pattern: videos/<mediaId>/original.mp4 → qualities/<mediaId>/
        const mediaId = parts[1]; // e.g. "abc-123-uuid"
        if (mediaId) {
          await deleteS3Prefix(`qualities/${mediaId}/`);
        }
      }

      // Delete HLS assets if they exist: hls/<mediaId>/
      if (parts.length >= 2) {
        const mediaId = parts[1];
        if (mediaId) {
          await deleteS3Prefix(`hls/${mediaId}/`);
        }
      }
    }
  }

  // Delete notes/PDF
  if (notesUrl) {
    const notesKey = getS3KeyFromUrl(notesUrl);
    if (notesKey) {
      await deleteFromS3(notesKey);
    }
  }
}
