/**
 * Unit tests — app/lib/auth.ts + app/lib/middleware.ts
 *
 * Real JWT sign/verify (no DB, no network) + the auth middleware guards
 * (extractUser / requireAuth / requireAdmin / requireSuperAdmin / getRequestId).
 * A valid JWT_SECRET is set before import (auth.ts fails fast otherwise).
 * Test-only env — never touches production config or the database.
 */

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-only-jwt-secret-value-0123456789-abcdef";
}

import { signToken, verifyToken, JwtPayload } from "@/app/lib/auth";
import {
  extractUser,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  getRequestId,
} from "@/app/lib/middleware";

// Minimal fake NextRequest: only .headers.get() is used by the middleware.
const reqWith = (headers: Record<string, string>) =>
  ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } } as never);

const USER: JwtPayload = { userId: "u1", email: "u@test.com", role: "user" };
const ADMIN: JwtPayload = { userId: "a1", email: "a@test.com", role: "admin" };
const SUPER: JwtPayload = { userId: "s1", email: "s@test.com", role: "super-admin" };

// ─── auth.ts ──────────────────────────────────────────────────────────────────

describe("signToken() / verifyToken()", () => {
  it("round-trips a payload (sign then verify)", () => {
    const token = signToken(USER);
    const decoded = verifyToken(token);
    expect(decoded).toMatchObject(USER);
  });

  it("verifyToken throws on a tampered/garbage token", () => {
    expect(() => verifyToken("not.a.jwt")).toThrow();
  });

  it("verifyToken throws on an expired token", () => {
    const token = signToken(USER, -1); // already expired
    expect(() => verifyToken(token)).toThrow();
  });

  it("honours a custom expiry without throwing", () => {
    const token = signToken(ADMIN, "1h");
    expect(verifyToken(token)).toMatchObject(ADMIN);
  });
});

// ─── extractUser ──────────────────────────────────────────────────────────────

describe("extractUser()", () => {
  it("returns the payload for a valid Bearer token", () => {
    const token = signToken(USER);
    const user = extractUser(reqWith({ authorization: `Bearer ${token}` }));
    expect(user).toMatchObject(USER);
  });

  it("returns null when the header is missing", () => {
    expect(extractUser(reqWith({}))).toBeNull();
  });

  it("returns null for an invalid token", () => {
    expect(extractUser(reqWith({ authorization: "Bearer garbage" }))).toBeNull();
  });
});

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe("requireAuth()", () => {
  it("passes through the user when authenticated", () => {
    const token = signToken(USER);
    const { error, user } = requireAuth(reqWith({ authorization: `Bearer ${token}` }));
    expect(error).toBeUndefined();
    expect(user).toMatchObject(USER);
  });

  it("returns a 401 error when unauthenticated", async () => {
    const { error, user } = requireAuth(reqWith({}));
    expect(user).toBeUndefined();
    expect(error!.status).toBe(401);
    const body = await error!.json();
    expect(body.success).toBe(false);
  });
});

// ─── requireAdmin ─────────────────────────────────────────────────────────────

describe("requireAdmin()", () => {
  it("allows an admin", () => {
    const token = signToken(ADMIN);
    const { error, user } = requireAdmin(reqWith({ authorization: `Bearer ${token}` }));
    expect(error).toBeUndefined();
    expect(user).toMatchObject(ADMIN);
  });

  it("allows a super-admin", () => {
    const token = signToken(SUPER);
    const { error } = requireAdmin(reqWith({ authorization: `Bearer ${token}` }));
    expect(error).toBeUndefined();
  });

  it("returns 403 for a normal user", async () => {
    const token = signToken(USER);
    const { error } = requireAdmin(reqWith({ authorization: `Bearer ${token}` }));
    expect(error!.status).toBe(403);
    const body = await error!.json();
    expect(body.message).toMatch(/Admin access required/);
  });

  it("returns 401 when unauthenticated (propagates requireAuth error)", () => {
    const { error } = requireAdmin(reqWith({}));
    expect(error!.status).toBe(401);
  });
});

// ─── requireSuperAdmin ────────────────────────────────────────────────────────

describe("requireSuperAdmin()", () => {
  it("allows a super-admin", () => {
    const token = signToken(SUPER);
    const { error, user } = requireSuperAdmin(reqWith({ authorization: `Bearer ${token}` }));
    expect(error).toBeUndefined();
    expect(user).toMatchObject(SUPER);
  });

  it("returns 403 for a plain admin", async () => {
    const token = signToken(ADMIN);
    const { error } = requireSuperAdmin(reqWith({ authorization: `Bearer ${token}` }));
    expect(error!.status).toBe(403);
    const body = await error!.json();
    expect(body.message).toMatch(/Super admin access required/);
  });

  it("returns 401 when unauthenticated", () => {
    const { error } = requireSuperAdmin(reqWith({}));
    expect(error!.status).toBe(401);
  });
});

// ─── getRequestId ─────────────────────────────────────────────────────────────

describe("getRequestId()", () => {
  it("returns the x-request-id header when present", () => {
    expect(getRequestId(reqWith({ "x-request-id": "abc-123" }))).toBe("abc-123");
  });

  it("falls back to 'unknown' when absent", () => {
    expect(getRequestId(reqWith({}))).toBe("unknown");
  });
});
