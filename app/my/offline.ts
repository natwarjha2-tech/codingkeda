"use client";
/**
 * Browser offline downloads (same model as the desktop app's Downloads).
 *
 * - Lesson videos: one HLS rendition (the quality being watched; Auto → the
 *   smallest) is fetched through /api/lessons/[id]/web-hls, which runs the same
 *   access checks as streaming. The init file + every segment are stored in
 *   IndexedDB, inside the browser's private storage for this site. Nothing is
 *   written to the laptop's Downloads folder.
 * - Study material (PDF): the file bytes are stored the same way.
 * - Each item belongs to one student and expires after 30 days (desktop
 *   EXPIRY_DAYS = 30). Expired items are deleted the next time the list loads.
 * - Playback builds a playlist of blob: URLs at play time and revokes them
 *   afterwards.
 */
import { getToken } from "@/services/auth";

export const EXPIRY_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
const DB_NAME = "ck_offline";
const ITEMS = "items";
const BLOBS = "blobs";

export type OfflineType = "hls" | "pdf";
export type OfflineItem = {
  key: string;               // `${userId}_${lessonId}_${type}`
  userId: string;
  lessonId: string;
  courseId?: string;
  type: OfflineType;
  title: string;
  quality?: string;
  courseTitle: string;
  moduleTitle: string;
  fileSize: number;
  parts: number;             // number of stored blobs
  playlist?: string;         // HLS media playlist with `ckpart:N` placeholders
  downloadedAt: number;
  expiresAt: number;
};
export type OfflineListItem = OfflineItem & { daysLeft: number };

/* ───────────── IndexedDB helpers ───────────── */
let dbP: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Offline storage is not available in this browser."));
  if (!dbP) {
    dbP = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains(ITEMS)) d.createObjectStore(ITEMS, { keyPath: "key" });
        if (!d.objectStoreNames.contains(BLOBS)) d.createObjectStore(BLOBS);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => { dbP = null; reject(r.error || new Error("Could not open offline storage.")); };
    });
  }
  return dbP;
}
function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
async function store(name: string, mode: IDBTransactionMode) {
  return (await db()).transaction(name, mode).objectStore(name);
}
const partKey = (key: string, n: number) => `${key}/${n}`;

async function putPart(key: string, n: number, blob: Blob) {
  await req((await store(BLOBS, "readwrite")).put(blob, partKey(key, n)));
}
async function getPart(key: string, n: number): Promise<Blob | undefined> {
  return req((await store(BLOBS, "readonly")).get(partKey(key, n)));
}
async function deleteParts(key: string) {
  const s = await store(BLOBS, "readwrite");
  // Range delete removes every `${key}/N` entry.
  s.delete(IDBKeyRange.bound(`${key}/`, `${key}/\uffff`));
  await new Promise<void>((resolve, reject) => { s.transaction.oncomplete = () => resolve(); s.transaction.onerror = () => reject(s.transaction.error); });
}

export const offlineKey = (userId: string, lessonId: string, type: OfflineType) => `${userId}_${lessonId}_${type}`;

export async function getOffline(key: string): Promise<OfflineItem | undefined> {
  try { return await req((await store(ITEMS, "readonly")).get(key)); } catch { return undefined; }
}

/** All non-expired downloads for this student. Expired ones are removed. */
export async function listOffline(userId: string): Promise<OfflineListItem[]> {
  if (!userId) return [];
  const all: OfflineItem[] = await req((await store(ITEMS, "readonly")).getAll());
  const now = Date.now();
  const out: OfflineListItem[] = [];
  for (const it of all) {
    if (it.userId !== userId) continue;
    if (it.expiresAt <= now) { await deleteOffline(it.key).catch(() => {}); continue; }
    out.push({ ...it, daysLeft: Math.ceil((it.expiresAt - now) / DAY) });
  }
  return out.sort((a, b) => b.downloadedAt - a.downloadedAt);
}

export async function deleteOffline(key: string) {
  await deleteParts(key);
  await req((await store(ITEMS, "readwrite")).delete(key));
}

/* ───────────── download: HLS lesson ───────────── */
type Progress = (pct: number) => void;

async function authedText(url: string): Promise<string> {
  const token = getToken();
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  if (!r.ok) {
    let msg = `Download failed (${r.status}).`;
    try { const j = await r.json(); if (j?.error) msg = j.error; } catch { /* not json */ }
    throw new Error(msg);
  }
  return r.text();
}
async function fetchBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  // Segment URLs are CloudFront URLs with a signed query — no token is sent.
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal, cache: "no-store" });
      if (!r.ok) throw new Error(`Segment failed (${r.status}).`);
      return await r.blob();
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
      await new Promise((res) => setTimeout(res, 600 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Network error while downloading.");
}

type Variant = { url: string; height: number; bandwidth: number };
function parseMaster(text: string): Variant[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out: Variant[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const res = /RESOLUTION=\d+x(\d+)/i.exec(lines[i]);
    const bw = /BANDWIDTH=(\d+)/i.exec(lines[i]);
    const next = lines.slice(i + 1).find((l) => l && !l.startsWith("#"));
    if (next) out.push({ url: next, height: res ? +res[1] : 0, bandwidth: bw ? +bw[1] : 0 });
  }
  return out;
}

/**
 * Download one HLS rendition of a lesson into browser storage.
 * `quality` is the label the student is watching (e.g. "720p"); null/"Auto" → smallest.
 */
export async function downloadLessonHls(opts: {
  userId: string; lessonId: string; courseId?: string; title: string; courseTitle: string; moduleTitle: string;
  quality?: string | null; onProgress?: Progress; signal?: AbortSignal;
}): Promise<OfflineItem> {
  const { userId, lessonId } = opts;
  if (!userId) throw new Error("Please log in to download.");
  const key = offlineKey(userId, lessonId, "hls");
  const existing = await getOffline(key);
  if (existing && existing.expiresAt > Date.now()) return existing;
  if (existing) await deleteOffline(key);

  try { await navigator.storage?.persist?.(); } catch { /* optional */ }

  const base = `/api/lessons/${encodeURIComponent(lessonId)}/web-hls?file=`;
  const masterText = await authedText(`${base}master.m3u8`);
  const variants = parseMaster(masterText);

  // Pick the variant: exact quality if chosen, else the smallest.
  let mediaUrl: string;
  let qualityLabel = "";
  if (variants.length) {
    const wantH = opts.quality && /^\d+p$/i.test(opts.quality) ? parseInt(opts.quality, 10) : 0;
    const sorted = [...variants].sort((a, b) => a.height - b.height || a.bandwidth - b.bandwidth);
    const v = (wantH && sorted.find((x) => x.height === wantH)) || sorted[0];
    mediaUrl = v.url;
    qualityLabel = v.height ? `${v.height}p` : "";
  } else {
    mediaUrl = `${base}master.m3u8`; // already a media playlist
  }
  const mediaText = masterText && !variants.length ? masterText : await authedText(mediaUrl);

  // Collect init (EXT-X-MAP) + segments; replace each with a placeholder.
  const urls: string[] = [];
  const lines = mediaText.split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith("#")) {
      if (/^#EXT-X-(MAP|KEY):/i.test(t)) {
        return t.replace(/URI="([^"]*)"/, (_m, u: string) => { urls.push(u); return `URI="ckpart:${urls.length - 1}"`; });
      }
      return line;
    }
    urls.push(t);
    return `ckpart:${urls.length - 1}`;
  });
  if (!urls.length) throw new Error("This video has no downloadable parts.");

  let size = 0;
  try {
    for (let i = 0; i < urls.length; i++) {
      if (opts.signal?.aborted) throw new Error("Download cancelled.");
      const b = await fetchBlob(new URL(urls[i], window.location.href).toString(), opts.signal);
      size += b.size;
      await putPart(key, i, b);
      opts.onProgress?.(Math.round(((i + 1) / urls.length) * 100));
    }
  } catch (e) {
    await deleteParts(key).catch(() => {});
    if (e instanceof DOMException && e.name === "QuotaExceededError") throw new Error("Not enough storage space in this browser.");
    throw e;
  }

  const now = Date.now();
  const item: OfflineItem = {
    key, userId, lessonId, courseId: opts.courseId, type: "hls",
    title: qualityLabel ? `${opts.title} (${qualityLabel})` : opts.title, quality: qualityLabel,
    courseTitle: opts.courseTitle || "Uncategorized", moduleTitle: opts.moduleTitle || "General",
    fileSize: size, parts: urls.length, playlist: lines.join("\n"), downloadedAt: now, expiresAt: now + EXPIRY_DAYS * DAY,
  };
  await req((await store(ITEMS, "readwrite")).put(item));
  return item;
}

/* ───────────── download: PDF study material ───────────── */
export async function downloadPdf(opts: {
  userId: string; id: string; courseId?: string; url: string; title: string; courseTitle: string; moduleTitle: string;
}): Promise<OfflineItem> {
  if (!opts.userId) throw new Error("Please log in to download.");
  const key = offlineKey(opts.userId, opts.id, "pdf");
  const existing = await getOffline(key);
  if (existing && existing.expiresAt > Date.now()) return existing;
  if (existing) await deleteOffline(key);
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
  let blob: Blob;
  try { blob = await fetchBlob(opts.url); }
  catch { throw new Error("Couldn't download this file. Please try again."); }
  await putPart(key, 0, blob);
  const now = Date.now();
  const item: OfflineItem = {
    key, userId: opts.userId, lessonId: opts.id, courseId: opts.courseId, type: "pdf", title: opts.title,
    courseTitle: opts.courseTitle || "Uncategorized", moduleTitle: opts.moduleTitle || "General",
    fileSize: blob.size, parts: 1, downloadedAt: now, expiresAt: now + EXPIRY_DAYS * DAY,
  };
  await req((await store(ITEMS, "readwrite")).put(item));
  return item;
}

/* ───────────── playback ───────────── */
/** Returns a blob: URL for the offline playlist (or PDF) and a cleanup function. */
export async function openOffline(key: string): Promise<{ url: string; type: OfflineType; item: OfflineItem; revoke: () => void }> {
  const item = await getOffline(key);
  if (!item) throw new Error("This download is no longer available.");
  if (item.expiresAt <= Date.now()) { await deleteOffline(key).catch(() => {}); throw new Error("This download has expired. Please download it again."); }
  const made: string[] = [];
  const revoke = () => made.forEach((u) => URL.revokeObjectURL(u));
  try {
    if (item.type === "pdf") {
      const b = await getPart(key, 0);
      if (!b) throw new Error("This file is missing. Please download it again.");
      const u = URL.createObjectURL(b.type ? b : new Blob([b], { type: "application/pdf" }));
      made.push(u);
      return { url: u, type: "pdf", item, revoke };
    }
    const partUrls: string[] = [];
    for (let i = 0; i < item.parts; i++) {
      const b = await getPart(key, i);
      if (!b) throw new Error("Part of this video is missing. Please download it again.");
      const u = URL.createObjectURL(b);
      made.push(u); partUrls.push(u);
    }
    const text = (item.playlist || "").replace(/ckpart:(\d+)/g, (_m, n: string) => partUrls[+n] || "");
    const pl = URL.createObjectURL(new Blob([text], { type: "application/vnd.apple.mpegurl" }));
    made.push(pl);
    return { url: pl, type: "hls", item, revoke };
  } catch (e) {
    revoke();
    throw e;
  }
}

export function formatBytes(bytes: number) {
  if (!bytes) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}
