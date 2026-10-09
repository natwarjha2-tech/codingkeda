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
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
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

// ── Cancellation / replace handling ──────────────────────────────────────────
// When a lesson's video is REPLACED while its old encode is still in flight (or
// queued), we must stop wasting work on the old video and not leave a mix of
// old+new quality files. We track which mediaId is currently encoding and a set
// of mediaIds that have been cancelled. A running encode checks `isCancelled`
// at safe checkpoints (after download, between ffmpeg variants, before the final
// DB write) and bails out cleanly. ffmpeg itself can't be interrupted mid-file,
// but the longest wait is a single variant, after which we abort.
let currentEncodingMediaId: string | null = null;
const cancelled = new Set<string>();

function isCancelled(mediaId: string): boolean {
  return cancelled.has(mediaId);
}

/**
 * Cancel any in-flight OR queued processing for a mediaId. Called when a lesson's
 * video is replaced/removed so the superseded encode stops and its (possibly
 * partial) output is treated as discarded. Safe to call for a mediaId that isn't
 * currently processing — it just removes it from the queue and marks it cancelled.
 */
export function cancelVideoProcessing(mediaId: string): void {
  if (!mediaId) return;
  // Remove from the pending queue so it never starts.
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i] === mediaId) queue.splice(i, 1);
  // Mark cancelled so a running encode for it aborts at its next checkpoint.
  cancelled.add(mediaId);
  logger.info("video-processor", "cancel_requested", { mediaId, running: currentEncodingMediaId === mediaId });
}

// Delete every quality object under a prefix (used to wipe partial/old qualities
// before a forced re-encode). Non-fatal.
async function wipeQualityPrefix(prefix: string): Promise<void> {
  if (!prefix) return;
  try {
    let token: string | undefined;
    const keys: { Key: string }[] = [];
    do {
      const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${prefix}/`, ContinuationToken: token }));
      for (const o of res.Contents || []) if (o.Key) keys.push({ Key: o.Key });
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    for (const k of keys) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: k.Key })).catch(() => {});
    }
    if (keys.length) logger.info("video-processor", "wiped_old_qualities", { prefix, count: keys.length });
  } catch { /* non-fatal */ }
}

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

async function uploadToS3(buffer: Buffer, key: string, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}
// Download the source object straight from S3 via the SDK and stream it to
// disk. We deliberately avoid a presigned URL + curl: AWS SDK v3 now injects
// `x-amz-checksum-mode=ENABLED` into presigned GET URLs, which plain curl can't
// satisfy, so the download would fail. The SDK handles checksums natively.
async function downloadFromS3(key: string, destPath: string) {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const body = res.Body as Readable | undefined;
      if (!body) throw new Error("empty S3 body");
      await pipeline(body, fs.createWriteStream(destPath));
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error(`S3 download failed: ${(lastErr as Error)?.message || "unknown error"}`);
}

async function encodeOne(mediaId: string, notify = true, force = false): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  // A fresh (re)start for this media clears any prior cancellation flag — this
  // IS the new encode the admin asked for.
  cancelled.delete(mediaId);
  currentEncodingMediaId = mediaId;

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, s3Key: true, hlsS3Prefix: true, type: true, title: true, uploadedBy: true },
  });
  // Nothing to do for a missing/non-video media — treat as a skip (not a failure).
  if (!media || media.type !== "VIDEO") {
    if (currentEncodingMediaId === mediaId) currentEncodingMediaId = null;
    cancelled.delete(mediaId);
    return { ok: true, skipped: true };
  }

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

  // If the media/lesson gets deleted while we encode (admin removed it), the
  // final update would throw "Record to update not found". And if the admin
  // replaced the video, `cancelVideoProcessing` marks this media cancelled.
  // Guard against both at every safe checkpoint.
  const stillExists = async () =>
    (await prisma.media.count({ where: { id: media.id } })) > 0;
  const aborted = async (): Promise<"deleted" | "cancelled" | null> => {
    if (isCancelled(media.id)) return "cancelled";
    if (!(await stillExists())) return "deleted";
    return null;
  };

  try {
    const { prefix, found } = await findExistingQualitiesInS3(media.id, media.s3Key, media.hlsS3Prefix);

    // FORCE = the video was replaced for this lesson. Wipe any existing/partial
    // qualities so we never serve a mix of the old and new video, then always
    // re-encode (don't take the "already exists" short-circuit).
    if (force) {
      await wipeQualityPrefix(prefix);
    } else if (found.length > 0) {
      // Not forced and qualities already exist in S3 → idempotent no-op.
      await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "ready", hlsQualities: found, hlsS3Prefix: prefix, hlsMasterUrl: null } });
      return { ok: true, skipped: true };
    }

    await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "processing" } });

    const ab0 = await aborted();
    if (ab0) {
      logger.info("video-processor", ab0 === "cancelled" ? "aborted_superseded" : "aborted_media_deleted", { mediaId: media.id });
      return { ok: true, skipped: true };
    }

    await downloadFromS3(media.s3Key, srcFile);
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
      // Stop between variants if the video was replaced (cancelled) or deleted.
      const abv = await aborted();
      if (abv) {
        logger.info("video-processor", abv === "cancelled" ? "aborted_superseded" : "aborted_media_deleted", { mediaId: media.id, afterQualities: qualities });
        return { ok: true, skipped: true };
      }
      const outputFile = path.join(tmpDir, `${variant.quality}.mp4`);
      const s3DestKey = `${prefix}/${variant.quality}.mp4`;
      // When NOT forced, reuse an existing quality object (idempotent resume).
      // When forced we already wiped the prefix, so always re-encode.
      if (!force && await s3ObjectExists(s3DestKey)) { qualities.push(variant.quality); continue; }
      const vf = `scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2`;
      await execAsync("ffmpeg", [
        "-y", "-i", srcFile, "-map", "0:v:0", "-map", "0:a:0?", "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "22",
        "-b:v", variant.videoBitrate, "-maxrate", variant.videoBitrate, "-bufsize", `${parseInt(variant.videoBitrate) * 2}k`,
        "-c:a", "copy", "-movflags", "+faststart", outputFile,
      ], { maxBuffer: 100 * 1024 * 1024 });
      // The ffmpeg run for this variant may have taken a while — if we were
      // superseded/deleted meanwhile, discard this output instead of uploading.
      const abAfter = await aborted();
      if (abAfter) {
        logger.info("video-processor", abAfter === "cancelled" ? "aborted_superseded" : "aborted_media_deleted", { mediaId: media.id });
        return { ok: true, skipped: true };
      }
      await uploadToS3(fs.readFileSync(outputFile), s3DestKey, "video/mp4");
      qualities.push(variant.quality);
    }

    // Final checkpoint before marking ready.
    const abFinal = await aborted();
    if (abFinal) {
      logger.info("video-processor", abFinal === "cancelled" ? "aborted_superseded" : "aborted_media_deleted", { mediaId: media.id });
      return { ok: true, skipped: true };
    }
    await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "ready", hlsQualities: qualities, hlsS3Prefix: prefix, hlsMasterUrl: null } });
    logger.success("video-processor", "ready", { mediaId: media.id, qualities });
    await notifyAdmin(true);
    return { ok: true };
  } catch (err) {
    const msg = (err as Error)?.message || "unknown error";
    logger.warn("video-processor", "failed", { mediaId: media.id, error: msg });
    // Only mark failed if this media still exists AND wasn't superseded — a
    // cancelled/deleted media must not be flipped to "failed".
    if (!isCancelled(media.id)) {
      await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "failed" } }).catch(() => {});
      await notifyAdmin(false, msg);
    }
    return { ok: false, error: msg };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (currentEncodingMediaId === media.id) currentEncodingMediaId = null;
    cancelled.delete(media.id); // this encode is done; clear its flag
  }
}

/**
 * Process ONE video by mediaId and AWAIT the result WITHOUT sending any
 * notification. Used by the lesson pipeline, which owns a single combined
 * notification covering video + quiz + exercise. Shares the same encode logic
 * and the same single-encode guard/queue as triggerVideoProcessing so two heavy
 * encodes never run at once. Never throws.
 */
export async function processVideoById(mediaId: string, opts: { force?: boolean } = {}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!mediaId) return { ok: true, skipped: true };
  // Wait for any in-flight encode (from the fire-and-forget queue) to finish so
  // we don't run two CPU-heavy encodes simultaneously, then run ours. If an old
  // encode is running for a DIFFERENT media that has since been cancelled, it
  // will bail at its next checkpoint — so this wait stays short.
  while (encoding) await new Promise((r) => setTimeout(r, 500));
  encoding = true;
  try {
    return await encodeOne(mediaId, /* notify */ false, opts.force === true);
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
