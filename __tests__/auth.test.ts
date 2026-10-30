/**
 * Unit tests — POST /api/auth/signup & POST /api/auth/login
 *
 * Mocks:  prisma, bcryptjs, app/lib/auth (signToken)
 * No real DB, no real hashing, no real JWT signing.
 */

import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// jest.mock hoisting requires these to be at the top, before any imports.

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("@/app/lib/auth", () => ({
  signToken: jest.fn(),
}));

// The signup route now uses a per-IP rate limiter, a structured logger, and a
// welcome notification. Mock them so the unit tests exercise the route's own
// logic deterministically (the limiter always allows; the logger/notification
// are no-ops). These mirror what the route imports today.
jest.mock("@/app/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: () => true, reset: () => {} }),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/app/lib/notification", () => ({
  notifyWelcome: jest.fn().mockResolvedValue(undefined),
}));

// The login route signs a fresh avatar URL via S3 helpers — stub them so no
// real AWS call happens (a user without an avatar skips these anyway).
jest.mock("@/app/lib/s3", () => ({
  getSignedFileUrlFromUrl: jest.fn().mockResolvedValue(null),
  getS3KeyFromUrl: jest.fn().mockReturnValue(null),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/app/lib/auth";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";

const mockSignToken = signToken as jest.MockedFunction<typeof signToken>;

// ─── Typed mock helpers ───────────────────────────────────────────────────────
// Cast once here so every test gets clean, typed access.

const mockUserFindUnique = prisma.user.findUnique as jest.MockedFunction<
  typeof prisma.user.findUnique
>;
const mockUserCreate = prisma.user.create as jest.MockedFunction<
  typeof prisma.user.create
>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<
  typeof bcrypt.compare
>;

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-uuid-1",
  email: "arjun@test.com",
  password: "hashed_password",
  role: "user",
  createdAt: new Date(),
};

const MOCK_ADMIN = { ...MOCK_USER, id: "user-uuid-2", email: "admin@test.com", role: "admin" };

// ─── Helper ───────────────────────────────────────────────────────────────────

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/signup
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    mockBcryptHash.mockResolvedValue("hashed_password" as never);
    mockSignToken.mockReturnValue("mock.jwt.token");
  });

  // A password that satisfies the route's strength policy (validatePassword):
  // 8+ chars, with an uppercase, lowercase, and a number.
  const STRONG_PW = "Secret123";

  // ── Happy paths ─────────────────────────────────────────────────────────────

  it("201 — valid signup returns token + user object", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(MOCK_USER as never);

    const res = await signupPOST(req({ email: "arjun@test.com", password: STRONG_PW }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.token).toBe("mock.jwt.token");
    expect(body.user).toMatchObject({ email: "arjun@test.com", role: "user" });
    expect(body.user.password).toBeUndefined(); // password must NOT be exposed
  });

  it("201 — new accounts are always created with role 'user'", async () => {
    // The route hardcodes role: "user" on signup (role is never taken from the
    // client — admin elevation is a separate, privileged flow). Even if a
    // client sends role:"admin", the created account is a normal user.
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(MOCK_USER as never);

    const res = await signupPOST(
      req({ email: "arjun@test.com", password: STRONG_PW, role: "admin" })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user.role).toBe("user");
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "user" }) })
    );
  });

  it("201 — password is hashed before saving (bcrypt.hash called)", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(MOCK_USER as never);

    await signupPOST(req({ email: "arjun@test.com", password: STRONG_PW }));

    expect(mockBcryptHash).toHaveBeenCalledWith(STRONG_PW, 10);
  });

  // ── Conflict ─────────────────────────────────────────────────────────────────

  it("409 — duplicate email returns conflict", async () => {
    mockUserFindUnique.mockResolvedValue(MOCK_USER as never);

    const res = await signupPOST(req({ email: "arjun@test.com", password: STRONG_PW }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/already registered/i);
  });

  // ── Validation failures ───────────────────────────────────────────────────────
  // The route validates body via a Zod schema (parseBody) first, then runs a
  // password-strength check (validatePassword). Each path returns 400.

  it("400 — missing email", async () => {
    const res = await signupPOST(req({ password: STRONG_PW }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/email/i);
  });

  it("400 — missing password", async () => {
    const res = await signupPOST(req({ email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/password/i);
  });

  it("400 — empty string email", async () => {
    const res = await signupPOST(req({ email: "", password: STRONG_PW }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — invalid email format (no @)", async () => {
    const res = await signupPOST(req({ email: "notanemail", password: STRONG_PW }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/email/i);
  });

  it("400 — invalid email format (missing domain)", async () => {
    const res = await signupPOST(req({ email: "user@", password: STRONG_PW }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/email/i);
  });

  it("400 — weak password (too short) is rejected", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await signupPOST(req({ email: "arjun@test.com", password: "Ab1" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/at least 8/i);
  });

  it("400 — password without an uppercase/number is rejected", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await signupPOST(req({ email: "arjun@test.com", password: "alllowercase" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  // ── Server error ──────────────────────────────────────────────────────────────

  it("500 — DB crash returns internal server error", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockRejectedValue(new Error("DB down") as never);

    const res = await signupPOST(req({ email: "arjun@test.com", password: STRONG_PW }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toMatch(/internal server error/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockSignToken.mockReturnValue("mock.jwt.token");
  });

  // ── Happy paths ─────────────────────────────────────────────────────────────

  it("200 — valid credentials return token + user", async () => {
    mockUserFindUnique.mockResolvedValue(MOCK_USER as never);
    mockBcryptCompare.mockResolvedValue(true as never);

    const res = await loginPOST(req({ email: "arjun@test.com", password: "secret123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.token).toBe("mock.jwt.token");
    expect(body.user).toMatchObject({ email: "arjun@test.com", role: "user" });
    expect(body.user.password).toBeUndefined();
  });

  it("200 — admin login message contains 'admin'", async () => {
    mockUserFindUnique.mockResolvedValue(MOCK_ADMIN as never);
    mockBcryptCompare.mockResolvedValue(true as never);

    const res = await loginPOST(req({ email: "admin@test.com", password: "secret123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.role).toBe("admin");
    expect(body.message).toMatch(/admin/i);
  });

  it("200 — bcrypt.compare is called with raw password + stored hash", async () => {
    mockUserFindUnique.mockResolvedValue(MOCK_USER as never);
    mockBcryptCompare.mockResolvedValue(true as never);

    await loginPOST(req({ email: "arjun@test.com", password: "secret123" }));

    expect(mockBcryptCompare).toHaveBeenCalledWith("secret123", "hashed_password");
  });

  // ── Auth failures ─────────────────────────────────────────────────────────────

  it("401 — non-existing user returns invalid credentials", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const res = await loginPOST(req({ email: "ghost@test.com", password: "secret123" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toMatch(/invalid credentials/i);
  });

  it("401 — wrong password returns invalid credentials", async () => {
    mockUserFindUnique.mockResolvedValue(MOCK_USER as never);
    mockBcryptCompare.mockResolvedValue(false as never);

    const res = await loginPOST(req({ email: "arjun@test.com", password: "wrongpass" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toMatch(/invalid credentials/i);
  });

  it("401 — error message is identical for missing user vs wrong password (no user enumeration)", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res1 = await loginPOST(req({ email: "ghost@test.com", password: "x" }));

    mockUserFindUnique.mockResolvedValue(MOCK_USER as never);
    mockBcryptCompare.mockResolvedValue(false as never);
    const res2 = await loginPOST(req({ email: "arjun@test.com", password: "wrong" }));

    expect((await res1.json()).message).toBe((await res2.json()).message);
  });

  // ── Validation failures ───────────────────────────────────────────────────────

  it("400 — missing email", async () => {
    const res = await loginPOST(req({ password: "secret123" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — missing password", async () => {
    const res = await loginPOST(req({ email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — empty body", async () => {
    const res = await loginPOST(req({}));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  // ── Server error ──────────────────────────────────────────────────────────────

  it("500 — DB crash returns internal server error", async () => {
    mockUserFindUnique.mockRejectedValue(new Error("DB timeout") as never);

    const res = await loginPOST(req({ email: "arjun@test.com", password: "secret123" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toMatch(/internal server error/i);
  });
});
