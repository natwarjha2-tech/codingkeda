import { getToken, isGuestSession, logoutUser } from "@/services/auth";

/** Error from the backend; carries HTTP status and the backend's `code`. */
export class ApiError extends Error {
  status: number;
  code?: string;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = typeof data.code === "string" ? data.code : undefined;
    this.data = data;
  }
}

type Init = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

/* ═══════════════════════════════════════════════════════════════════════════
 * PERSISTENT CACHE — same rules as the desktop app (src/renderer/app/cache.js):
 * per-user localStorage keys "ck_pcache_<userId>_<endpoint>", per-endpoint TTL,
 * stale-while-revalidate (show cached instantly, refresh silently), pre-fetch
 * after login, clear on refresh / user change, drop the oldest half when full.
 * ═══════════════════════════════════════════════════════════════════════════ */
const DAY = 24 * 60 * 60 * 1000;
const TTL = {
  default: 7 * DAY,
  dashboard: 5 * 60 * 1000,
  courses_list: 30 * 60 * 1000,
  course_detail: 30 * 60 * 1000,
  quiz: DAY,
  exercise: DAY,
  homework: DAY,
  streak: 60 * 60 * 1000,
  leaderboard: 5 * 60 * 1000,
  feedback: 10 * 60 * 1000,
  profile: 10 * 60 * 1000,
  coins: 5 * 60 * 1000,
  play: 45 * 60 * 1000,
  live: 30 * 1000,
};

/** Desktop _ckCacheGetTTL, same order of checks. */
function ttlFor(ep: string): number {
  if (ep.includes("/api/live/classes")) return TTL.live;
  if (ep.includes("/play")) return TTL.play;
  if (ep.includes("/api/quiz")) return TTL.quiz;
  if (ep.includes("/api/exercise")) return TTL.exercise;
  if (ep.includes("/api/homework")) return TTL.homework;
  if (ep.includes("/api/weekly-streak")) return TTL.streak;
  if (ep.includes("/api/leaderboard")) return TTL.leaderboard;
  if (ep.includes("/api/feedback")) return TTL.feedback;
  if (ep.includes("/api/courses/") && !ep.includes("?")) return TTL.course_detail;
  if (ep.includes("/api/courses/")) return TTL.course_detail; // ?signed=true detail (web uses the query form)
  if (ep === "/api/courses") return TTL.courses_list;
  if (ep.includes("/api/student/dashboard")) return TTL.dashboard;
  if (ep.includes("/api/coins")) return TTL.coins;
  if (ep === "/api/student") return TTL.profile;
  return TTL.default;
}

/**
 * GET endpoints that may be cached. Anything with one-time/short-lived signed
 * media (web-hls playlists, signed-url) or live state is deliberately NOT here.
 */
const CACHEABLE = [
  /^\/api\/student$/, /^\/api\/student\/(dashboard|progress|orders|avatar)/, /^\/api\/courses(\/[^/?]+)?(\?.*)?$/,
  /^\/api\/coins$/, /^\/api\/achievements$/, /^\/api\/xp$/, /^\/api\/mall$/, /^\/api\/discount$/, /^\/api\/coding-problems$/,
  /^\/api\/certificates$/, /^\/api\/referral$/, /^\/api\/app-config$/, /^\/api\/feedback\/lesson\?lessonId=app_rating$/,
  /^\/api\/weekly-streak\?/, /^\/api\/quiz\?/, /^\/api\/exercise\?/, /^\/api\/homework\?/,
  /^\/api\/live\/classes\/enrolled$/, /^\/api\/live\/classes\/recordings\/mine$/,
  // Desktop caches the lesson play answer for 45 min (its S3 links are signed for 60 min).
  /^\/api\/lessons\/[^/]+\/play$/,
];
const cacheable = (path: string) => CACHEABLE.some((r) => r.test(path));

const PREFIX = "ck_pcache_";
const ls = (): Storage | null => (typeof window === "undefined" ? null : window.localStorage);
/** Short fingerprint of the login token, so a cache entry can't be read under a different login. */
export const tokenTag = (t: string | null) => (t ? t.slice(-16) : "");
/**
 * Same identity the classroom layout stores after /api/student. Only trusted when
 * it was saved for THIS login token — so if another student signs in, nothing of
 * the previous student is ever shown, even for a moment.
 */
function currentUserId(): string {
  try {
    const u = JSON.parse(ls()?.getItem("ck_my_user") || "null");
    if (!u?.id) return "";
    if (u.t && u.t !== tokenTag(getToken())) return "";
    return u.id as string;
  } catch { return ""; }
}
const keyFor = (uid: string, ep: string) => `${PREFIX}${uid}_${ep.replace(/[^a-zA-Z0-9]/g, "_")}`;

type Entry = { ts: number; data: unknown };
function readEntry(ep: string): Entry | null {
  const uid = currentUserId(); const s = ls();
  if (!uid || !s) return null;
  try {
    const raw = s.getItem(keyFor(uid, ep));
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry;
    if (Date.now() - e.ts > TTL.default) { s.removeItem(keyFor(uid, ep)); return null; } // older than 7 days → gone
    return e;
  } catch { return null; }
}

/** Cached data (fresh OR stale) for an endpoint, or null. */
export function cacheGet<T = unknown>(ep: string): { data: T; fresh: boolean } | null {
  const e = readEntry(ep);
  return e ? { data: e.data as T, fresh: Date.now() - e.ts < ttlFor(ep) } : null;
}
export function cacheIsFresh(ep: string): boolean { return !!cacheGet(ep)?.fresh; }

export function cacheSet(ep: string, data: unknown) {
  const uid = currentUserId(); const s = ls();
  if (!uid || !s || data == null) return;
  const v = JSON.stringify({ ts: Date.now(), data });
  try { s.setItem(keyFor(uid, ep), v); }
  catch { cleanupOldest(uid); try { s.setItem(keyFor(uid, ep), v); } catch { /* still full */ } }
}
export function cacheRemove(ep: string) {
  const uid = currentUserId();
  if (uid) try { ls()?.removeItem(keyFor(uid, ep)); } catch { /* ignore */ }
}
function userKeys(uid: string): string[] {
  const s = ls(); if (!s) return [];
  const p = `${PREFIX}${uid}_`, out: string[] = [];
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(p)) out.push(k); }
  return out;
}
/** Remove every cached endpoint for one user (Refresh button / logout). */
export function cacheClearUser(uid = currentUserId()) {
  if (uid) userKeys(uid).forEach((k) => ls()?.removeItem(k));
}
function cleanupOldest(uid: string) {
  const s = ls(); if (!s) return;
  const entries = userKeys(uid).map((k) => { try { return { k, ts: (JSON.parse(s.getItem(k) || "{}") as Entry).ts || 0 }; } catch { return { k, ts: 0 }; } });
  entries.sort((a, b) => a.ts - b.ts);
  entries.slice(0, Math.max(1, Math.floor(entries.length / 2))).forEach((e) => s.removeItem(e.k));
}
/** A different student signed in on this browser → drop the previous student's cache. */
export function cacheDetectUserChange(newUid: string) {
  const s = ls(); if (!s || !newUid) return;
  const last = s.getItem(`${PREFIX}last_user`);
  if (last && last !== newUid) cacheClearUser(last);
  s.setItem(`${PREFIX}last_user`, newUid);
}

/**
 * After a change (quiz submit, lesson complete, redeem…) the per-student data
 * is out of date — drop it so the next screen loads fresh. Catalogue-style data
 * (course list, app config, coding problems, ratings) is kept.
 */
const KEEP_ON_WRITE = ["/api/courses", "/api/app-config", "/api/coding-problems", "/api/feedback/lesson?lessonId=app_rating"];
// Writes that don't change anything shown from the cache (learning-time pings,
// notification sync, view counters).
const SILENT_WRITES = [/^\/api\/attendance/, /^\/api\/notifications/, /^\/api\/lessons\/[^/]+\/view/];
function invalidateAfterWrite(path: string) {
  if (SILENT_WRITES.some((r) => r.test(path))) return;
  const uid = currentUserId(); if (!uid) return;
  const keep = new Set(KEEP_ON_WRITE.map((ep) => keyFor(uid, ep)));
  userKeys(uid).forEach((k) => { if (!keep.has(k)) ls()?.removeItem(k); });
}

/**
 * Stale-while-revalidate read (desktop pattern):
 * - cached data → `onData` immediately (instant screen)
 * - then ALWAYS refresh in the background and call `onData` again if it changed
 *   (desktop pages: "Cache-first … Background refresh")
 * - `skipIfFresh` → no network while the copy is within its TTL. The desktop does
 *   this only for course detail, quiz and exercise (ckCacheIsFresh … return).
 * Rejects only when there was nothing cached AND the fetch failed, so
 * existing `.catch()` handlers keep working.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCached<T = any>(path: string, onData: (d: T) => void | Promise<void>, opts: { skipIfFresh?: boolean } = {}): Promise<void> {
  const hit = cacheGet<T>(path);
  if (hit) await onData(hit.data);
  if (hit?.fresh && opts.skipIfFresh) return;
  try {
    const fresh = await api<T>(path);
    if (!hit || JSON.stringify(fresh) !== JSON.stringify(hit.data)) await onData(fresh);
  } catch (e) {
    if (!hit) throw e;
  }
}

/** One value: the cached copy while it's within its TTL, otherwise the network (desktop ckCacheIsFresh check). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiOnce<T = any>(path: string): Promise<T> {
  const hit = cacheGet<T>(path);
  if (hit?.fresh) return hit.data;
  try { return await api<T>(path); } catch (e) { if (hit) return hit.data; throw e; }
}

/** Desktop _ckCachePreFetchAll — warm every main screen right after login (skips fresh ones). */
const PREFETCH = [
  "/api/student/dashboard", "/api/student", "/api/courses", "/api/coding-problems", "/api/coins",
  "/api/achievements", "/api/student/orders", "/api/mall", "/api/student/progress",
  "/api/live/classes/enrolled", "/api/feedback/lesson?lessonId=app_rating", "/api/xp",
];
export function cachePrefetchAll() {
  PREFETCH.forEach((ep) => { if (!cacheIsFresh(ep)) api(ep).catch(() => { /* background */ }); });
  // Desktop: weekly-streak data 2 s later, once the dashboard (course list) is cached.
  setTimeout(() => {
    apiOnce("/api/student/dashboard").then((d) => {
      ((d?.enrolledCourses || []) as { id: string }[]).forEach((c) => {
        const ep = `/api/weekly-streak?courseId=${encodeURIComponent(c.id)}`;
        if (!cacheIsFresh(ep)) api(ep).catch(() => { /* background */ });
      });
    }).catch(() => { /* background */ });
  }, 2000);
}

/**
 * fetch() for the logged-in area: adds the Bearer token, parses JSON, throws
 * ApiError on a non-2xx answer. A 401 means the login is no longer valid, so the
 * student is sent to the login page and brought back here afterwards.
 */
// Identical GETs already on their way (e.g. the page and the after-login prefetch
// both asking for /api/coins): the second caller shares the first request.
const inflight = new Map<string, Promise<unknown>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path: string, init: Init = {}): Promise<T> {
  const plainGet = (init.method || "GET").toUpperCase() === "GET" && init.json === undefined && init.body === undefined && !init.signal;
  if (!plainGet) return request<T>(path, init);
  const key = `${tokenTag(getToken())}|${path}`; // never share between two logins
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = request<T>(path, init).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function request<T>(path: string, init: Init): Promise<T> {
  const { json, headers, ...rest } = init;
  const h: Record<string, string> = { ...(headers as Record<string, string>) };
  if (json !== undefined) h["Content-Type"] = "application/json";
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    ...rest,
    headers: h,
    body: json !== undefined ? JSON.stringify(json) : init.body,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    if (typeof window !== "undefined") {
      if (res.status === 401) {
        const wasGuest = isGuestSession();
        logoutUser();
        localStorage.removeItem("ck_token");
        // A guest's 4 hours are over: back to the free lessons, not a login form.
        window.location.replace(wasGuest ? "/free-learning" : `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      } else if (res.status === 403 && data.code === "PARENT_CONSENT_REQUIRED") {
        window.location.replace("/parent-consent");
      }
    }
    const msg = (data.message as string) || (data.error as string) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  // Keep the cache in step with every successful call.
  const method = (rest.method || "GET").toUpperCase();
  if (method === "GET") { if (cacheable(path)) cacheSet(path, data); }
  else invalidateAfterWrite(path);
  return data as T;
}

/** "MM:SS", "HH:MM:SS" or plain seconds -> seconds. Unset values give 0. */
export function durationToSeconds(d: string | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  const s = String(d).trim();
  if (!s || s === "00:00" || s === "0") return 0;
  if (!s.includes(":")) {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  const p = s.split(":").map((x) => parseInt(x, 10));
  if (p.some((n) => Number.isNaN(n))) return 0;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}

/** 125 -> "2m", 4000 -> "1h 6m". */
export function prettyDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${Math.max(1, m)}m`;
}
