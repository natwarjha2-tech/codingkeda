/**
 * Video quality processor — generates 720/480/360 MP4s for ONE video and
 * uploads them to S3, then marks the Media row "ready" (or "failed").
 *
 * Called directly (fire-and-forget) from the admin save/update endpoints the
 * moment a video is confirmed, so processing of THAT specific video starts
 * immediately on the EC2 — no polling, no batch. Requires ffmpeg/ffprobe on the
 * host (present on the EC2). On Vercel/serverless this is a no-op-ish failure
 * (ffmpeg missing) which just leaves the video "pending".
 */
import { prisma } from "@/app/lib/prisma";
import { s3 } from "@/app/lib/s3";
import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "@/app/lib/logger";
import { createNotification } from "@/app/lib/notification";
import { NOTIF_TYPES, NOTIF_CATEGORIES, NOTIF_PRIORITIES } from "@/app/lib/notification-types";

const execAsync = promisify(execFile);
const BUCKET = process.env.AWS_S3_BUCKET_NAME!;

const QUALITY_VARIANTS = [
  { quality: "720p", width: 1280, height: 720, videoBitrate: "2800k" },
  { quality: "480p", width: 854, height: 480, videoBitrate: "1400k" },
  { quality: "360p", width: 640, height: 360, videoBitrate: "800k" },
];

// Guard so a single server process doesn't run two CPU-heavy encodes at once.
// Videos triggered while one is running are queued (processed sequentially).
let encoding = false;
const queue: string[] = [];

function slugify(name: string | null | undefined): string {
  const s = String(name || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s || "untitled";
}

async function resolveQualityPrefix(mediaId: string, s3Key: string, storedPrefix?: string | null): Promise<string> {
  if (storedPrefix) return storedPrefix;
  try {
    const lesson = await prisma.lesson.findFirst({
      where: { videoUrl: { contains: s3Key } },
      select: { title: true, module: { select: { title: true, course: { select: { title: true } } } } },
    });
    if (lesson) {
      return `qualities/${slugify(lesson.module?.course?.title)}/${slugify(lesson.module?.title)}/${slugify(lesson.title)}-${mediaId}`;
    }
  } catch { /* fall through */ }
  return `qualities/${mediaId}`;
}

async function s3ObjectExists(key: string): Promise<boolean> {
  try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function listQualitiesByMediaId(mediaId: string): Promise<{ prefix: string; found: string[] } | null> {
  const matches: string[] = [];
  let token: string | undefined;
  try {
    do {
      const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "qualities/", ContinuationToken: token }));
      for (const o of res.Contents || []) if (o.Key && o.Key.includes(mediaId) && o.Key.endsWith(".mp4")) matches.push(o.Key);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  } catch { return null; }
  if (matches.length === 0) return null;
  const prefix = matches[0].slice(0, matches[0].lastIndexOf("/"));
  const found = matches.map((k) => k.slice(k.lastIndexOf("/") + 1).replace(/\.mp4$/, ""))
    .filter((q) => QUALITY_VARIANTS.some((v) => v.quality === q));
  return { prefix, found };
}

async function findExistingQualitiesInS3(mediaId: string, s3Key: string, storedPrefix?: string | null): Promise<{ prefix: string; found: string[] }> {
  const prefix = await resolveQualityPrefix(mediaId, s3Key, storedPrefix);
  const found: string[] = [];
  for (const v of QUALITY_VARIANTS) if (await s3ObjectExists(`${prefix}/${v.quality}.mp4`)) found.push(v.quality);
  if (found.length > 0) return { prefix, found };
  const byId = await listQualitiesByMediaId(mediaId);
  if (byId && byId.found.length > 0) return byId;
  return { prefix, found: [] };
}

async function getSignedS3Url(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 21600 });
}
async function uploadToS3(buffer: Buffer, key: string, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}
async function downloadFile(url: string, destPath: string) {
  await execAsync("curl", ["-L", "--retry", "3", "--retry-delay", "5", "-C", "-", "--retry-connrefused", "-o", destPath, url]);
}

async function encodeOne(mediaId: string, notify = true): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, s3Key: true, hlsS3Prefix: true, type: true, title: true, uploadedBy: true },
  });
  // Nothing to do for a missing/non-video media — treat as a skip (not a failure).
  if (!media || media.type !== "VIDEO") return { ok: true, skipped: true };

  // Notify the admin who uploaded this video of the outcome. Idempotency key
  // includes the mediaId + outcome so a success and a (prior) failure are
  // distinct, and retries don't spam duplicates.
  const notifyAdmin = async (ok: boolean, detail?: string) => {
    if (!notify) return; // pipeline owns the combined notification — stay silent
    if (!media.uploadedBy) return;
    try {
      await createNotification({
        userId: media.uploadedBy,
        type: ok ? NOTIF_TYPES.VIDEO_PROCESSED : NOTIF_TYPES.VIDEO_PROCESS_FAILED,
        category: NOTIF_CATEGORIES.SYSTEM,
        priority: ok ? NOTIF_PRIORITIES.NORMAL : NOTIF_PRIORITIES.HIGH,
        title: ok ? "Video ready ✅" : "Video processing failed ❌",
        body: ok
          ? `"${media.title}" is processed and ready to stream in all qualities.`
          : `"${media.title}" could not be processed${detail ? `: ${detail}` : ""}. You can re-save the lesson to retry.`,
        metadata: { mediaId: media.id },
        idempotencyKey: `video_proc_${ok ? "ok" : "fail"}_${media.id}_${Date.now()}`,
      });
    } catch { /* notification failure must never break processing */ }
  };

  const tmpDir = path.join(os.tmpdir(), `ck_proc_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const srcFile = path.join(tmpDir, "source.mp4");

  try {
    // Skip if qualities already exist in S3 (idempotent).
    const { prefix, found } = await findExistingQualitiesInS3(media.id, media.s3Key, media.hlsS3Prefix);
    if (found.length > 0) {
      await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "ready", hlsQualities: found, hlsS3Prefix: prefix, hlsMasterUrl: null } });
      // Qualities already present (e.g. re-save of an existing video) — treat as
      // ready, no notification needed (nothing was actually processed).
      return { ok: true, skipped: true };
    }

    await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "processing" } });

    const signedUrl = await getSignedS3Url(media.s3Key);
    await downloadFile(signedUrl, srcFile);
    if (!fs.existsSync(srcFile) || fs.statSync(srcFile).size === 0) throw new Error("source download failed/empty");

    let sourceHeight = 1080;
    try {
      const { stdout } = await execAsync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0", srcFile]);
      sourceHeight = parseInt(stdout.trim()) || 1080;
    } catch { /* keep default */ }

    const applicable = QUALITY_VARIANTS.filter((v) => v.height <= sourceHeight + 100);
    if (applicable.length === 0) applicable.push(QUALITY_VARIANTS[QUALITY_VARIANTS.length - 1]);
    const qualities: string[] = [];

    for (const variant of applicable) {
      const outputFile = path.join(tmpDir, `${variant.quality}.mp4`);
      const s3DestKey = `${prefix}/${variant.quality}.mp4`;
      if (await s3ObjectExists(s3DestKey)) { qualities.push(variant.quality); continue; }
      const vf = `scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2`;
      await execAsync("ffmpeg", [
        "-y", "-i", srcFile, "-map", "0:v:0", "-map", "0:a:0?", "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "22",
        "-b:v", variant.videoBitrate, "-maxrate", variant.videoBitrate, "-bufsize", `${parseInt(variant.videoBitrate) * 2}k`,
        "-c:a", "copy", "-movflags", "+faststart", outputFile,
      ], { maxBuffer: 100 * 1024 * 1024 });
      await uploadToS3(fs.readFileSync(outputFile), s3DestKey, "video/mp4");
      qualities.push(variant.quality);
    }

    await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "ready", hlsQualities: qualities, hlsS3Prefix: prefix, hlsMasterUrl: null } });
    logger.success("video-processor", "ready", { mediaId: media.id, qualities });
    await notifyAdmin(true);
    return { ok: true };
  } catch (err) {
    const msg = (err as Error)?.message || "unknown error";
    logger.warn("video-processor", "failed", { mediaId: media.id, error: msg });
    await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "failed" } }).catch(() => {});
    await notifyAdmin(false, msg);
    return { ok: false, error: msg };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Process ONE video by mediaId and AWAIT the result WITHOUT sending any
 * notification. Used by the lesson pipeline, which owns a single combined
 * notification covering video + quiz + exercise. Shares the same encode logic
 * and the same single-encode guard/queue as triggerVideoProcessing so two heavy
 * encodes never run at once. Never throws.
 */
export async function processVideoById(mediaId: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!mediaId) return { ok: true, skipped: true };
  // Wait for any in-flight encode (from the fire-and-forget queue) to finish so
  // we don't run two CPU-heavy encodes simultaneously, then run ours.
  while (encoding) await new Promise((r) => setTimeout(r, 500));
  encoding = true;
  try {
    return await encodeOne(mediaId, /* notify */ false);
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || "unknown error" };
  } finally {
    encoding = false;
    // Drain anything that queued up while we held the lock.
    void drain();
  }
}

// Drain the queue one encode at a time.
async function drain() {
  if (encoding) return;
  encoding = true;
  try {
    while (queue.length > 0) {
      const id = queue.shift()!;
      await encodeOne(id);
    }
  } finally {
    encoding = false;
  }
}

/**
 * Kick off background processing for ONE video by mediaId. Fire-and-forget:
 * returns immediately so the admin's save request isn't blocked by the encode.
 * If an encode is already running, this video is queued behind it.
 */
export function triggerVideoProcessing(mediaId: string): void {
  if (!mediaId) return;
  if (!queue.includes(mediaId)) queue.push(mediaId);
  // Start draining on the next tick; never await (fire-and-forget).
  void drain();
}
