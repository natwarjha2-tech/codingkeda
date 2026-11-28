/**
 * Guest (try-before-you-sign-up) accounts — shared constants.
 *
 * A visitor who is not logged in and opens a free lesson gets their own
 * temporary student account: role "guest", a fake email on a reserved
 * `.invalid` domain, and a 4-hour login. Everything they earn is stored like a
 * normal student's data and deleted when they leave (or by the daily cleanup).
 *
 * This file has NO database imports so the edge middleware can use it too.
 */
export const GUEST_ROLE = "guest";
/** Reserved TLD (RFC 2606) — can never be a real mailbox. */
export const GUEST_EMAIL_DOMAIN = "@guest.codingkida.invalid";
export const GUEST_NAME = "Guest Student";
/** Guest login lifetime. After this the token is useless, so the account can be removed. */
export const GUEST_TOKEN_TTL = "4h";
export const GUEST_TTL_MS = 4 * 60 * 60 * 1000;

export const isGuestRole = (role: string | undefined | null) => role === GUEST_ROLE;
export const isGuestEmail = (email: string | undefined | null) => !!email && email.toLowerCase().endsWith(GUEST_EMAIL_DOMAIN);

/** Prisma filter for rows owned by real (non-guest) students — used by leaderboards and ranks. */
export const NOT_GUEST_USER = { user: { role: { not: GUEST_ROLE } } } as const;

/**
 * Rows of real students, plus (optionally) the one guest looking at the board,
 * so a guest sees their own rank while other people never see guests.
 */
export function realUsersOr(viewerId?: string | null) {
  return viewerId ? { OR: [NOT_GUEST_USER, { userId: viewerId }] } : NOT_GUEST_USER;
}

/**
 * API paths a guest may NOT use (account, money, referral, parent, live, public
 * reviews). `write` = only non-GET requests are blocked.
 * Checked in middleware.ts; route handlers stay unchanged.
 */
export const GUEST_BLOCKED: { prefix: string; write?: boolean }[] = [
  { prefix: "/api/admin" },
  { prefix: "/api/account" },
  { prefix: "/api/auth/change-password" },
  { prefix: "/api/payment" },
  { prefix: "/api/enroll-token" },
  { prefix: "/api/referral" },
  { prefix: "/api/mall/redeem" },
  { prefix: "/api/discount", write: true },
  { prefix: "/api/live" },
  { prefix: "/api/devices" },
  { prefix: "/api/whatsapp" },
  { prefix: "/api/student/consent", write: true },
  { prefix: "/api/student/parent-verify" },
  { prefix: "/api/student/subscription", write: true },
  { prefix: "/api/student/profile", write: true },
  { prefix: "/api/student/avatar", write: true },
  { prefix: "/api/auth/device" },
  { prefix: "/api/auth/web-handoff" },
  { prefix: "/api/feedback", write: true },
  { prefix: "/api/lesson-chat", write: true },
  { prefix: "/api/final-test", write: true },
  { prefix: "/api/certificates", write: true },
];

export function guestBlocked(path: string, method: string): boolean {
  const isWrite = method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD";
  // A bare `/api/student` POST creates a Student record (profile) — not for guests.
  if (path === "/api/student" && isWrite) return true;
  return GUEST_BLOCKED.some((r) => (path === r.prefix || path.startsWith(r.prefix + "/")) && (!r.write || isWrite));
}

/**
 * Read the role from a Bearer token WITHOUT verifying it (edge-safe).
 * Only used to DENY guests: a token whose payload was edited fails the real
 * signature check in every route, so this can't be used to gain access.
 */
export function unverifiedRole(authHeader: string | null): string | null {
  try {
    const token = authHeader?.replace(/^Bearer\s+/i, "") || "";
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}
