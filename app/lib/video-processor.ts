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
import { getHlsMasterUrl } from "@/app/lib/s3";

const execAsync = promisify(execFile);
const BUCKET = process.env.AWS_S3_BUCKET_NAME!;

/**
 * Base directory for encode scratch files (source download + quality MP4s + HLS
 * segments). This must live on a REAL disk with room for several GB, NOT the
 * default `/tmp` — on the EC2 host `/tmp` is a ~1GB RAM-backed tmpfs, so writing
 * a source video + its renditions there overflows it and the download/encode
 * fails with "errno -122 ... write". `/` has tens of GB free, so we use a dir
 * there instead. Resolution order:
 *   1. VIDEO_TMP_DIR env (explicit override), else
 *   2. TMPDIR env (if the operator pointed it at real disk), else
 *   3. <process cwd>/.video-tmp  — the app runs from /home/ubuntu/codingkeda,
 *      which is on the 48G root volume.
 * The dir is created on first use; if that somehow fails we fall back to
 * os.tmpdir() so processing still attempts rather than hard-failing.
 */
function encodeTmpBase(): string {
  const candidate =
    process.env.VIDEO_TMP_DIR ||
    process.env.TMPDIR ||
    path.join(process.cwd(), ".video-tmp");
  try {
    fs.mkdirSync(candidate, { recursive: true });
    return candidate;
  } catch {
    return os.tmpdir();
  }
}

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
  // Immutable media (unique keyed) — long cache so CloudFront holds it at the
  // edge instead of weakly caching + re-missing (see IMMUTABLE_CACHE_CONTROL in
  // app/lib/s3.ts).
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
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

// Upload one HLS file (playlist or segment) with the right content-type +
// cache header. .m3u8 playlists are small + change rarely (short cache);
// segments are immutable (long cache).
async function uploadHlsObject(buffer: Buffer, key: string) {
  const isPlaylist = key.endsWith(".m3u8");
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: isPlaylist ? "application/vnd.apple.mpegurl" : "video/mp2t",
    CacheControl: isPlaylist
      ? "public, max-age=60"                       // playlist: refresh-able
      : "public, max-age=31536000, immutable",     // segment: forever
  }));
}

/**
 * Generate a multi-variant HLS rendition (master.m3u8 + per-quality variant
 * playlists + .ts segments) from the source and upload everything under
 * hls/<mediaId>/. Returns the STABLE CloudFront master URL (served with signed
 * cookies) or null on failure.
 *
 * ADDITIVE + NON-FATAL: this runs AFTER the MP4 qualities are produced. If it
 * throws, the caller ignores it — the MP4 qualities remain the playable
 * fallback, so a student is never left without video.
 *
 * Audio is re-encoded to AAC consistently across all segments (NOT stream-copy)
 * — mismatched/stream-copied audio across HLS segments was the source of the
 * old "audio noise" problem; AAC-LC at a fixed bitrate avoids it.
 */
async function generateAndUploadHls(
  srcFile: string,
  variants: typeof QUALITY_VARIANTS,
  tmpDir: string,
  mediaId: string,
  aborted: () => Promise<"deleted" | "cancelled" | null>,
): Promise<string | null> {
  const hlsDir = path.join(tmpDir, "hls");
  fs.mkdirSync(hlsDir, { recursive: true });
  const hlsPrefix = `hls/${mediaId}`;

  // Does the source actually have an audio track? A graph that references [0:a]
  // (asplit) hard-fails on a silent source, unlike the MP4 pass's optional
  // `0:a:0?`. Probe once so we only build the audio half of the graph when there
  // IS audio — otherwise produce video-only HLS (no noise, no crash).
  let hasAudio = false;
  try {
    const { stdout } = await execAsync("ffprobe", [
      "-v", "error", "-select_streams", "a:0",
      "-show_entries", "stream=index", "-of", "csv=p=0", srcFile,
    ]);
    hasAudio = stdout.trim().length > 0;
  } catch { hasAudio = false; }

  // Detect the source frame rate so we can set an exact GOP (keyframe interval).
  // ABR streaming REQUIRES every rendition to place keyframes at the SAME
  // timestamps — otherwise the player stalls/glitches when it switches bitrate
  // mid-playback (Apple HLS authoring spec: keyframe every ~2s, identical across
  // renditions). We compute fps and use GOP = round(fps * 2) → one keyframe
  // every ~2 seconds, with scene-cut keyframes disabled so nothing drifts.
  let fps = 30;
  try {
    const { stdout } = await execAsync("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", srcFile,
    ]);
    const raw = stdout.trim(); // e.g. "30000/1001" or "25/1"
    const m = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
    const val = m ? parseInt(m[1]) / parseInt(m[2]) : parseFloat(raw);
    if (Number.isFinite(val) && val > 0 && val <= 120) fps = val;
  } catch { /* keep default 30 */ }
  const gop = Math.max(1, Math.round(fps * 2)); // keyframe every ~2s
  const KEYINT_SECONDS = 2;

  // Build one ffmpeg invocation that outputs ALL variants + a master playlist.
  // -var_stream_map ties each output rendition to a variant; %v expands to the
  // variant index in the segment/playlist filenames.
  const args: string[] = ["-y", "-i", srcFile];
  const varStreamParts: string[] = [];
  const n = variants.length;

  // A filter-graph input pad ([0:v]) can only be consumed ONCE. Referencing
  // [0:v] directly in several scale chains makes ffmpeg SPLIT the frames across
  // those chains instead of duplicating them — which showed up as each variant
  // getting only part of the picture (half-frame video) and garbled audio.
  // Fix: explicitly fan the source video out into N copies with `split` (and the
  // audio into N copies with `asplit`), then scale/encode each copy independently.
  const filterParts: string[] = [];

  // 1) Split the source video into N labelled copies: [vin0][vin1]...
  const vSplitOut = variants.map((_, i) => `[vin${i}]`).join("");
  filterParts.push(`[0:v]split=${n}${vSplitOut}`);

  // 2) Scale+pad each copy to its target box (keeps aspect ratio, pads to fill).
  variants.forEach((v, i) => {
    filterParts.push(
      `[vin${i}]scale=${v.width}:${v.height}:force_original_aspect_ratio=decrease,` +
      `pad=${v.width}:${v.height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
    );
  });

  // 3) Split the source audio into N labelled copies: [ain0][ain1]... so each
  //    variant gets its OWN full audio stream (not a divided one → no noise).
  //    Only when the source has audio (else video-only HLS).
  if (hasAudio) {
    const aSplitOut = variants.map((_, i) => `[ain${i}]`).join("");
    filterParts.push(`[0:a]asplit=${n}${aSplitOut}`);
  }

  // Map each scaled video + (when present) its dedicated audio copy.
  variants.forEach((_, i) => {
    args.push("-map", `[v${i}]`);
    if (hasAudio) args.push("-map", `[ain${i}]`);
  });

  // Per-variant VIDEO encode settings.
  //
  // H.264 High profile (broad device + ExoPlayer/AVPlayer support). Every
  // rendition uses the SAME GOP structure so keyframes land at identical
  // timestamps across qualities — the prerequisite for seamless ABR switching:
  //   -g gop            fixed keyframe interval (~2s)
  //   -keyint_min gop   forbid shorter GOPs (no early keyframes)
  //   -sc_threshold 0   disable scene-cut keyframes (which would misalign)
  //   -force_key_frames every 2s (belt-and-suspenders alignment, independent of
  //                     per-rendition encoder decisions)
  // CBR-ish caps (-maxrate/-bufsize) keep each rung within its bandwidth budget
  // so the master playlist's BANDWIDTH values are honest for the player.
  variants.forEach((v, i) => {
    args.push(
      `-c:v:${i}`, "libx264",
      `-preset:v:${i}`, "veryfast",
      `-profile:v:${i}`, "high",
      `-crf:v:${i}`, "21",
      `-b:v:${i}`, v.videoBitrate,
      `-maxrate:v:${i}`, v.videoBitrate,
      `-bufsize:v:${i}`, `${parseInt(v.videoBitrate) * 2}k`,
      `-g:v:${i}`, String(gop),
      `-keyint_min:v:${i}`, String(gop),
      `-sc_threshold:v:${i}`, "0",
      `-force_key_frames:v:${i}`, `expr:gte(t,n_forced*${KEYINT_SECONDS})`,
    );
  });
  // Consistent AAC audio for every rendition (fixes HLS audio-noise). Only when
  // the source has audio.
  if (hasAudio) {
    args.push("-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000");
  }
  args.push("-filter_complex", filterParts.join(";"));
  args.push("-pix_fmt", "yuv420p");

  // var_stream_map: each variant is "v:<i>" plus "a:<i>" only when we mapped
  // audio for it (an a:<i> with no corresponding audio output errors out).
  variants.forEach((_, i) => {
    varStreamParts.push(hasAudio ? `v:${i},a:${i}` : `v:${i}`);
  });

  args.push(
    "-f", "hls",
    "-hls_time", "6",                       // ~6s segments (good cache granularity)
    "-hls_playlist_type", "vod",
    "-hls_flags", "independent_segments",
    "-hls_segment_type", "mpegts",
    "-master_pl_name", "master.m3u8",
    "-hls_segment_filename", path.join(hlsDir, "v%v_seg%d.ts"),
    "-var_stream_map", varStreamParts.join(" "),
    path.join(hlsDir, "v%v.m3u8"),
  );

  await execAsync("ffmpeg", args, { maxBuffer: 100 * 1024 * 1024 });

  // Bail cleanly if the encode was superseded/deleted while we worked.
  if (await aborted()) return null;

  // Upload every generated file (master.m3u8, v0.m3u8…, v*_seg*.ts) to S3.
  const files = fs.readdirSync(hlsDir).filter((f) => f.endsWith(".m3u8") || f.endsWith(".ts"));
  if (!files.some((f) => f === "master.m3u8")) {
    throw new Error("HLS master playlist was not produced");
  }
  for (const f of files) {
    await uploadHlsObject(fs.readFileSync(path.join(hlsDir, f)), `${hlsPrefix}/${f}`);
  }

  return getHlsMasterUrl(hlsPrefix);
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

  const tmpDir = path.join(encodeTmpBase(), `ck_proc_${Date.now()}`);
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

    // ── HLS pass (ADDITIVE, NON-FATAL) ──────────────────────────────────────
    // Produce an adaptive HLS rendition (master.m3u8 + segments) under
    // hls/<mediaId>/ for mobile adaptive streaming via CloudFront signed
    // cookies. If this fails, we still have the MP4 qualities above as the
    // fallback — so HLS failure must NEVER fail the whole encode. On a FORCE
    // re-encode, wipe any stale HLS first.
    let hlsMasterUrl: string | null = null;
    try {
      if (force) {
        try { await wipeQualityPrefix(`hls/${media.id}`); } catch { /* non-fatal */ }
      }
      hlsMasterUrl = await generateAndUploadHls(srcFile, applicable, tmpDir, media.id, aborted);
      if (hlsMasterUrl) logger.success("video-processor", "hls_ready", { mediaId: media.id });
    } catch (hlsErr) {
      // Keep going with MP4-only; log and move on.
      logger.warn("video-processor", "hls_failed_fallback_mp4", { mediaId: media.id, error: (hlsErr as Error)?.message || "unknown" });
      hlsMasterUrl = null;
    }

    await prisma.media.update({ where: { id: media.id }, data: { hlsStatus: "ready", hlsQualities: qualities, hlsS3Prefix: prefix, hlsMasterUrl } });
    logger.success("video-processor", "ready", { mediaId: media.id, qualities, hls: !!hlsMasterUrl });
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
