/**
 * CodingKida — Live-class recording → HLS (ISOLATED helper)
 *
 * Turns a finished Chime recording into an HLS stream under
 * hls/live-<recordingId>/ so it plays like any course video (CloudFront signed
 * cookies + hls.js / ExoPlayer, segment-by-segment loading, 720/480/360 Auto).
 *
 * State lives in S3, NOT the database (no schema change):
 *   • ready      → hls/live-<id>/ready.json exists (written after every segment)
 *   • processing → queued/encoding in THIS server process (in-memory)
 *   • failed     → last attempt failed (retried automatically after a cool-down)
 *   • pending    → not converted yet (gets queued on the next list/play request)
 * After a server restart, anything unfinished is simply re-queued lazily the
 * next time someone opens the recordings list — self-healing.
 */
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3, listAllObjects } from "@/app/lib/s3";
import {
  encodeRecordingToHls,
  recordingHlsMarkerKey,
  recordingHlsPrefix,
} from "@/app/lib/video-processor";

const BUCKET = process.env.AWS_S3_BUCKET_NAME!;

export type RecordingHlsStatus = "ready" | "processing" | "failed" | "pending";

// Chunks keep landing for a little while after the capture pipeline stops.
// Only convert once the newest chunk is at least this old (otherwise the tail
// of the class would be cut off).
const SETTLE_MS = 90 * 1000;
// Wait before retrying a failed conversion (avoid hot-looping on a bad source).
const RETRY_AFTER_MS = 30 * 60 * 1000;
// Cache "not ready" answers briefly so listing recordings doesn't HEAD S3 each time.
const NEG_CACHE_MS = 30 * 1000;

const ready = new Set<string>();
const notReadyAt = new Map<string, number>();
const jobs = new Map<string, { status: "queued" | "processing" | "failed"; at: number }>();
const waitTries = new Map<string, number>();

export { recordingHlsPrefix };

/** Is this recording's HLS fully uploaded? (S3 marker; cached.) Never throws. */
export async function isRecordingHlsReady(recordingId: string): Promise<boolean> {
  if (ready.has(recordingId)) return true;
  const neg = notReadyAt.get(recordingId);
  if (neg && Date.now() - neg < NEG_CACHE_MS) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: recordingHlsMarkerKey(recordingId) }));
    ready.add(recordingId);
    notReadyAt.delete(recordingId);
    return true;
  } catch {
    notReadyAt.set(recordingId, Date.now());
    return false;
  }
}

/** Current status for the client (call isRecordingHlsReady first). */
export function getRecordingHlsStatus(recordingId: string): RecordingHlsStatus {
  if (ready.has(recordingId)) return "ready";
  const j = jobs.get(recordingId);
  if (!j) return "pending";
  return j.status === "failed" ? "failed" : "processing";
}

/**
 * Pick what to encode from a recording's S3 root ("live-recordings/<class>/<rec>"):
 *   1) the AWS-concatenated full file under final/ (if AWS produced one), else
 *   2) every composited-video chunk, in time order (Chime names chunks by
 *      timestamp, so key order = playback order).
 * `settled` is false while chunks are still being written.
 */
async function findSources(s3Key: string): Promise<{ keys: string[]; settled: boolean }> {
  const base = s3Key.endsWith("/") ? s3Key : s3Key + "/";
  const isMp4 = (k: string) => k.toLowerCase().endsWith(".mp4");

  const finals = (await listAllObjects(base + "final/")).filter((o) => isMp4(o.key));
  if (finals.length) {
    const composited = finals.filter((o) => o.key.includes("/composited-video/"));
    const pick = (composited.length ? composited : finals).reduce((a, b) => (b.size > a.size ? b : a));
    return { keys: [pick.key], settled: true };
  }

  const all = await listAllObjects(base);
  const chunks = all
    .filter((o) => isMp4(o.key) && o.key.includes("/composited-video/") && !o.key.includes("/final/"))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const newest = all.reduce((m, o) => (o.modified > m ? o.modified : m), 0);
  // Nothing in S3 at all yet → keep waiting up to ~1h (pipeline flush), then give up.
  const settled = newest > 0 ? Date.now() - newest >= SETTLE_MS : false;
  return { keys: chunks.map((c) => c.key), settled };
}

/**
 * Queue a recording for HLS conversion (deduped, fire-and-forget). Safe to call
 * repeatedly — on every list/play request — it only does work once.
 */
export function queueRecordingHls(rec: { id: string; s3Key: string }, delayMs = 0): void {
  if (!rec?.id || !rec.s3Key || ready.has(rec.id)) return;
  const j = jobs.get(rec.id);
  if (j && (j.status === "queued" || j.status === "processing")) return;
  if (j && j.status === "failed" && Date.now() - j.at < RETRY_AFTER_MS) return;

  jobs.set(rec.id, { status: "queued", at: Date.now() });
  later(() => { void runJob(rec); }, Math.max(0, delayMs));
}

// Background timer that never keeps the process alive on its own (clean server
// shutdown / test runs). If the process exits first, the job is simply re-queued
// lazily the next time the recordings list is opened.
function later(fn: () => void, ms: number): void {
  const t = setTimeout(fn, ms) as unknown as { unref?: () => void };
  if (t && typeof t.unref === "function") t.unref();
}

async function runJob(rec: { id: string; s3Key: string }): Promise<void> {
  try {
    // Someone else (or an earlier run before a restart) may have finished it.
    notReadyAt.delete(rec.id);
    if (await isRecordingHlsReady(rec.id)) { jobs.delete(rec.id); return; }

    const { keys, settled } = await findSources(rec.s3Key);
    if (keys.length === 0 && settled) {
      // Writing finished but there is no video at all (empty/failed capture).
      jobs.set(rec.id, { status: "failed", at: Date.now() });
      return;
    }
    if (keys.length === 0 || !settled) {
      // Still being written (or nothing yet) → check again shortly, but give up
      // after ~1h so an empty recording never polls S3 forever.
      const tries = (waitTries.get(rec.id) || 0) + 1;
      waitTries.set(rec.id, tries);
      if (tries > 40) {
        waitTries.delete(rec.id);
        jobs.set(rec.id, { status: "failed", at: Date.now() });
        return;
      }
      jobs.set(rec.id, { status: "queued", at: Date.now() });
      later(() => { void runJob(rec); }, SETTLE_MS);
      return;
    }

    waitTries.delete(rec.id);
    jobs.set(rec.id, { status: "processing", at: Date.now() });
    const result = await encodeRecordingToHls({ recordingId: rec.id, sourceKeys: keys });
    if (result.ok) {
      ready.add(rec.id);
      jobs.delete(rec.id);
    } else {
      jobs.set(rec.id, { status: "failed", at: Date.now() });
    }
  } catch (err) {
    console.error("recording-hls: job failed", rec.id, err);
    jobs.set(rec.id, { status: "failed", at: Date.now() });
  }
}
