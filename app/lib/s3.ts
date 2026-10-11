import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

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

// Extract the object KEY from either an S3 URL (…amazonaws.com/<key>) or a
// CloudFront URL (https://<cf-domain>/<key>). Returns the path (minus the
// leading "/") with any query params (signatures) stripped — so it works for
// raw, S3-signed, or CloudFront-signed URLs alike.
export function getS3KeyFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const isS3 = parsed.href.indexOf(".amazonaws.com/") !== -1;
    const cfHost = (process.env.CLOUDFRONT_DOMAIN || "").replace(/^https?:\/\//, "");
    const isCf = cfHost && parsed.host === cfHost;
    if (!isS3 && !isCf) return null;
    // Use pathname only — strip query params (signed-URL params).
    return decodeURIComponent(parsed.pathname.substring(1));
  } catch {
    return null;
  }
}

/**
 * Sign a key for delivery to the client. When CloudFront is fully configured
 * (CLOUDFRONT_DOMAIN + CLOUDFRONT_KEY_PAIR_ID + CLOUDFRONT_PRIVATE_KEY), return
 * a CloudFront SIGNED URL so the bytes are served from the CDN edge (fast,
 * cached). Otherwise fall back to an S3 presigned URL (current behaviour) — so
 * nothing breaks before the CloudFront env vars are set in production.
 *
 * This is the single choke point every caller (lesson /play, Codo sources,
 * study material, downloads) already routes through, so flipping to CloudFront
 * requires no change anywhere else — and no app change (clients just play the
 * URL they're given).
 */
export async function getSignedFileUrlFromUrl(url: string, expiresIn = 3600) {
  const key = getS3KeyFromUrl(url);
  if (!key) throw new Error("Invalid S3/CloudFront URL.");
  if (isCloudFrontConfigured()) {
    return signCloudFrontUrl(key, expiresIn);
  }
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

// ── CloudFront signed URLs ───────────────────────────────────────────────────
// Serve video/quality/material bytes from the CloudFront edge (fast, cached)
// instead of straight from S3. We sign with a canned policy using Node's crypto
// (RSA-SHA1 over the policy) — the same thing @aws-sdk/cloudfront-signer does
// internally — so NO extra npm dependency is needed.
//
// Required env (all three, else we fall back to S3 presigning automatically):
//   CLOUDFRONT_DOMAIN       e.g. "d1234abcd.cloudfront.net" (no scheme)
//   CLOUDFRONT_KEY_PAIR_ID  the public key / key-pair id from the CF key group
//   CLOUDFRONT_PRIVATE_KEY  the PEM private key (literal, with \n line breaks)
const CF_DOMAIN = (process.env.CLOUDFRONT_DOMAIN || "").replace(/^https?:\/\//, "");
const CF_KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID || "";
// Private key may be stored in .env with literal "\n" sequences — normalise them.
const CF_PRIVATE_KEY = (process.env.CLOUDFRONT_PRIVATE_KEY || "").replace(/\\n/g, "\n");

export function isCloudFrontConfigured(): boolean {
  return !!(CF_DOMAIN && CF_KEY_PAIR_ID && CF_PRIVATE_KEY);
}

// CloudFront-safe base64 (per AWS docs: +→-, =→_, /→~).
function cfSafeBase64(input: Buffer | string): string {
  const b64 = (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString("base64");
  return b64.replace(/\+/g, "-").replace(/=/g, "_").replace(/\//g, "~");
}

/**
 * Build a CloudFront SIGNED URL (canned policy) for an object key, valid for
 * `expiresIn` seconds. Caller must have verified access already — signing just
 * authorizes delivery of this one object from the CDN.
 */
export function signCloudFrontUrl(key: string, expiresIn = 3600): string {
  const resourceUrl = `https://${CF_DOMAIN}/${key}`;
  const expires = Math.floor(Date.now() / 1000) + expiresIn;

  // Canned policy: single resource + expiry. CloudFront reconstructs it from
  // the Expires param, so we don't send Policy for a canned policy.
  const policy = JSON.stringify({
    Statement: [
      {
        Resource: resourceUrl,
        Condition: { DateLessThan: { "AWS:EpochTime": expires } },
      },
    ],
  });

  const signer = crypto.createSign("RSA-SHA1");
  signer.update(policy);
  const signature = cfSafeBase64(signer.sign(CF_PRIVATE_KEY));

  const sep = resourceUrl.includes("?") ? "&" : "?";
  return (
    `${resourceUrl}${sep}Expires=${expires}` +
    `&Signature=${signature}` +
    `&Key-Pair-Id=${CF_KEY_PAIR_ID}`
  );
}

// Base CDN URL for a key (unsigned). Used where the asset is public or signing
// is handled elsewhere; falls back to the S3 public URL when CF isn't set.
export function getHlsUrl(s3Key: string): string {
  if (CF_DOMAIN) {
    return `https://${CF_DOMAIN}/${s3Key}`;
  }
  return getPublicUrl(s3Key);
}

// Signed CDN URL for an HLS/segment key — now a real CloudFront signed URL when
// configured (else an S3 presigned URL fallback).
export async function getSignedHlsUrl(s3Key: string, expiresIn = 3600): Promise<string> {
  if (isCloudFrontConfigured()) return signCloudFrontUrl(s3Key, expiresIn);
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
 * Delete the S3 objects for a single VIDEO media: the original file + its
 * processed quality folder. The quality prefix comes from the stored
 * `hlsS3Prefix` (the reliable source) — NOT parsed from the key — so it works
 * with any folder layout. All failures are non-fatal (logged).
 */
export async function deleteVideoMediaS3(
  s3UrlOrKey: string | null | undefined,
  hlsS3Prefix?: string | null,
  mediaId?: string | null,
): Promise<void> {
  if (s3UrlOrKey) {
    const key = getS3KeyFromUrl(s3UrlOrKey) || s3UrlOrKey;
    if (key) await deleteFromS3(key);
  }
  // 1) Delete processed qualities using the stored prefix (fast, exact).
  if (hlsS3Prefix && hlsS3Prefix.trim()) {
    const pfx = hlsS3Prefix.endsWith("/") ? hlsS3Prefix : hlsS3Prefix + "/";
    await deleteS3Prefix(pfx);
  }
  // 2) ALSO sweep by mediaId. The stored prefix is frequently null — the video
  //    was deleted/replaced before processing finished (status pending/
  //    processing/failed never stored a prefix), or an encode wrote qualities
  //    after the row's prefix was read. Every quality key embeds the mediaId
  //    (qualities/.../<slug>-<mediaId>/<q>.mp4), so we can always find and
  //    remove them by id even when hlsS3Prefix is missing. Non-fatal.
  if (mediaId && mediaId.trim()) {
    await deleteQualitiesByMediaId(mediaId);
  }
}

/**
 * Delete every object under the `qualities/` prefix whose key contains the given
 * mediaId. A reliable fallback when `hlsS3Prefix` wasn't stored. Paginates the
 * full listing and batch-deletes. Fails silently (logged).
 */
export async function deleteQualitiesByMediaId(mediaId: string): Promise<void> {
  if (!mediaId) return;
  try {
    const toDelete: { Key: string }[] = [];
    let token: string | undefined;
    do {
      const res = await s3.send(
        new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "qualities/", ContinuationToken: token }),
      );
      for (const o of res.Contents || []) {
        if (o.Key && o.Key.includes(mediaId)) toDelete.push({ Key: o.Key });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);

    if (toDelete.length === 0) return;
    // Delete in batches of 1000 (S3 DeleteObjects limit).
    for (let i = 0; i < toDelete.length; i += 1000) {
      const batch = toDelete.slice(i, i + 1000);
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: batch } }));
    }
    console.log(`S3 qualities deleted by mediaId ${mediaId} (${toDelete.length} objects)`);
  } catch (err) {
    console.error(`S3 quality cleanup by mediaId failed: ${mediaId}`, err);
  }
}

/**
 * Delete a single non-video file (PDF/PPT/image) from S3 by its URL/key.
 */
export async function deleteFileMediaS3(s3UrlOrKey: string | null | undefined): Promise<void> {
  if (!s3UrlOrKey) return;
  const key = getS3KeyFromUrl(s3UrlOrKey) || s3UrlOrKey;
  if (key) await deleteFromS3(key);
}
