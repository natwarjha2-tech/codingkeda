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
import { HeadObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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
// Recordings deleted by the host in this process (never re-queue / re-upload).
const deletedIds = new Set<string>();
// Abort handle per active conversion — delete() kills its ffmpeg immediately.
const controllers = new Map<string, AbortController>();

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
  if (!rec?.id || !rec.s3Key || ready.has(rec.id) || deletedIds.has(rec.id)) return;
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
    if (deletedIds.has(rec.id)) { jobs.delete(rec.id); return; }
    jobs.set(rec.id, { status: "processing", at: Date.now() });
    const ctrl = new AbortController();
    controllers.set(rec.id, ctrl);
    let result: { ok: boolean };
    try {
      result = await encodeRecordingToHls({ recordingId: rec.id, sourceKeys: keys, signal: ctrl.signal });
    } finally {
      controllers.delete(rec.id);
    }
    if (deletedIds.has(rec.id)) {
      // Host deleted it while it was converting → remove what was just uploaded.
      await deletePrefixAll(`${recordingHlsPrefix(rec.id)}/`);
      jobs.delete(rec.id);
      return;
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// REPLAY TIMELINE (chat + reactions synced to the recording)
// ─────────────────────────────────────────────────────────────────────────────
// Chat/reactions are not part of the Chime video, so the player shows them in a
// side panel synced to the playback time (like YouTube live-chat replay). This
// resolves the two things that needs from S3:
//   • startMs   — wall-clock time of the FIRST video chunk = video time 0
//                 (chunk names are UTC timestamps yyyy-mm-dd-hh-mm-ss-mmm)
//   • reactions — floating class reactions (topic "ck-live-react") from Chime's
//                 data-channel capture: .txt files of JSON objects
//                 { Timestamp, Topic, Data, SenderAttendeeId }
// Read-only, cached per recording, never throws.

export interface RecordingTimeline {
  startMs: number | null;
  reactions: { emoji: string; atMs: number }[];
}

const timelineCache = new Map<string, { at: number; data: RecordingTimeline }>();
const TIMELINE_TTL_MS = 10 * 60 * 1000;
const REACT_TOPIC = "ck-live-react";

/** "…/2026-11-11-16-17-05-123.mp4" (UTC) → epoch ms; null if not a timestamp name. */
function chunkNameToMs(key: string): number | null {
  const name = key.slice(key.lastIndexOf("/") + 1);
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{1,3})/);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7].padEnd(3, "0"));
  return Number.isFinite(ms) ? ms : null;
}

function parseTimestamp(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string" && v) {
    if (/^\d+$/.test(v)) { const n = Number(v); return n < 1e12 ? n * 1000 : n; }
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

/** Data may be plain JSON text or base64 of it — accept both. */
function parseReactionData(data: unknown): string | null {
  if (typeof data !== "string" || !data) return null;
  const tryJson = (s: string): string | null => {
    try {
      const p = JSON.parse(s);
      return p && typeof p.reaction === "string" ? p.reaction : null;
    } catch { return null; }
  };
  return tryJson(data) ?? tryJson(Buffer.from(data, "base64").toString("utf8"));
}

/** Every JSON object in a data-channel .txt (one per line, an array, or concatenated). */
function extractJsonObjects(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const t = text.trim();
  if (!t) return out;
  try {
    const whole = JSON.parse(t);
    if (Array.isArray(whole)) return whole.filter((o) => o && typeof o === "object");
    if (whole && typeof whole === "object") return [whole];
  } catch { /* fall through to line/brace scanning */ }
  // Scan balanced {...} blocks (handles newline-delimited or back-to-back objects).
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        try { out.push(JSON.parse(t.slice(start, i + 1))); } catch { /* skip */ }
        start = -1;
      }
    }
  }
  return out;
}

async function readText(key: string): Promise<string> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return (await res.Body?.transformToString("utf-8")) || "";
  } catch {
    return "";
  }
}

export async function getRecordingTimeline(rec: { id: string; s3Key: string }): Promise<RecordingTimeline> {
  const hit = timelineCache.get(rec.id);
  if (hit && Date.now() - hit.at < TIMELINE_TTL_MS) return hit.data;

  const data: RecordingTimeline = { startMs: null, reactions: [] };
  if (!rec.s3Key) return data;
  const base = (rec.s3Key.endsWith("/") ? rec.s3Key : rec.s3Key + "/") + "capture/";

  try {
    const all = await listAllObjects(base);

    // Video time 0 = earliest composited-video chunk.
    let start: number | null = null;
    for (const o of all) {
      if (!o.key.includes("/composited-video/") || !o.key.toLowerCase().endsWith(".mp4")) continue;
      const ms = chunkNameToMs(o.key);
      if (ms != null && (start == null || ms < start)) start = ms;
    }
    data.startMs = start;

    // Floating reactions from the data-channel capture (small text files).
    const dc = all.filter((o) => o.key.includes("/data-channel/")).slice(0, 2000);
    for (const o of dc) {
      const fileMs = chunkNameToMs(o.key);
      for (const msg of extractJsonObjects(await readText(o.key))) {
        if (msg.Topic !== REACT_TOPIC && msg.topic !== REACT_TOPIC) continue;
        const emoji = parseReactionData(msg.Data ?? msg.data);
        const atMs = parseTimestamp(msg.Timestamp ?? msg.timestamp) ?? fileMs;
        if (emoji && atMs != null) data.reactions.push({ emoji: emoji.slice(0, 16), atMs });
      }
    }
    data.reactions.sort((a, b) => a.atMs - b.atMs);
  } catch (err) {
    console.error("recording-hls: timeline failed", rec.id, err);
  }

  timelineCache.set(rec.id, { at: Date.now(), data });
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE (host action)
// ─────────────────────────────────────────────────────────────────────────────

/** Delete EVERY object under a prefix (paginated, batches of 1000). */
async function deletePrefixAll(prefix: string): Promise<number> {
  const objs = await listAllObjects(prefix);
  let deleted = 0;
  for (let i = 0; i < objs.length; i += 1000) {
    const batch = objs.slice(i, i + 1000).map((o) => ({ Key: o.key }));
    await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: batch, Quiet: true } }));
    deleted += batch.length;
  }
  return deleted;
}

/**
 * Delete a recording's media from S3: the raw Chime capture + AWS final files
 * (live-recordings/<classId>/<recordingId>/…) and its HLS stream
 * (hls/live-<recordingId>/…). Strictly scoped — refuses any key that is not
 * exactly this recording's own folder, so a bad value can never delete other
 * files. Also stops any pending/ongoing conversion and clears caches.
 */
export async function deleteRecordingMedia(rec: { id: string; s3Key: string }): Promise<{ ok: boolean; deleted: number }> {
  if (!rec?.id) return { ok: false, deleted: 0 };
  deletedIds.add(rec.id);
  // Stop an in-progress conversion right now (kills ffmpeg / leaves the queue).
  try { controllers.get(rec.id)?.abort(); } catch { /* ignore */ }
  ready.delete(rec.id);
  jobs.delete(rec.id);
  waitTries.delete(rec.id);
  notReadyAt.delete(rec.id);
  timelineCache.delete(rec.id);

  let deleted = 0;
  try {
    // HLS output (always safe: the folder name is derived from the id).
    deleted += await deletePrefixAll(`${recordingHlsPrefix(rec.id)}/`);

    // Raw recording folder — only if it is exactly ".../<classId>/<recordingId>".
    const key = (rec.s3Key || "").replace(/\/+$/, "");
    const parts = key.split("/");
    if (parts.length === 3 && parts.every(Boolean) && parts[2] === rec.id) {
      deleted += await deletePrefixAll(`${key}/`);
    } else if (key) {
      console.warn("recording-hls: skipped raw delete, unexpected key", rec.id, key);
    }
    return { ok: true, deleted };
  } catch (err) {
    console.error("recording-hls: delete failed", rec.id, err);
    return { ok: false, deleted };
  }
}
