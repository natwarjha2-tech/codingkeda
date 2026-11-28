import { getWebDevice } from "@/app/lib/web-device";

const TOKEN_KEY = "token";

export type AuthResponse = {
  success: boolean;
  token: string;
  user: { email: string };
};

/** Login error; `code` is set for device-limit answers (e.g. "DEVICE_LIMIT"). */
export class LoginError extends Error {
  code?: string;
  data: Record<string, unknown>;
  constructor(message: string, data: Record<string, unknown>) {
    super(message);
    this.code = typeof data.code === "string" ? data.code : undefined;
    this.data = data;
  }
}

// Swap fetch URL to real backend when ready
export async function loginUser(
  credentials: { email: string; password: string },
  replaceDevice = false,
): Promise<AuthResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...credentials, device: getWebDevice(), replaceDevice }),
  });
  const data = await res.json();
  if (!res.ok) throw new LoginError(data.message || "Login failed.", data);
  return { success: true, token: data.token, user: { email: credentials.email } };
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function logoutUser(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** Role/expiry from the stored login (decoded locally, for display only — the server checks the signature). */
export function tokenClaims(token: string | null = getToken()): { role?: string; exp?: number } | null {
  try {
    const part = token?.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
  } catch { return null; }
}

/** True when the stored login is a temporary guest (try-before-sign-up) session. */
export function isGuestSession(token: string | null = getToken()): boolean {
  return tokenClaims(token)?.role === "guest";
}

/** A guest login whose 4 hours are over (the server rejects it). */
export function isExpiredGuest(token: string | null = getToken()): boolean {
  const c = tokenClaims(token);
  return c?.role === "guest" && !!c.exp && c.exp * 1000 <= Date.now();
}

/** Forget the login on this browser (all keys the site uses). */
export function clearLocalSession(): void {
  logoutUser();
  for (const k of ["ck_token", "user", "userEmail", "ck_my_user"]) localStorage.removeItem(k);
}
