import { getToken, logoutUser } from "@/services/auth";

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

/**
 * fetch() for the logged-in area: adds the Bearer token, parses JSON, throws
 * ApiError on a non-2xx answer. A 401 means the login is no longer valid, so the
 * student is sent to the login page and brought back here afterwards.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path: string, init: Init = {}): Promise<T> {
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
        logoutUser();
        localStorage.removeItem("ck_token");
        window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      } else if (res.status === 403 && data.code === "PARENT_CONSENT_REQUIRED") {
        window.location.replace("/parent-consent");
      }
    }
    const msg = (data.message as string) || (data.error as string) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
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
