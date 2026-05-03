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

  // ── Happy paths ─────────────────────────────────────────────────────────────

  it("201 — valid signup returns token + user object", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(MOCK_USER as never);

    const res = await signupPOST(req({ email: "arjun@test.com", password: "secret123" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.token).toBe("mock.jwt.token");
    expect(body.user).toMatchObject({ email: "arjun@test.com", role: "user" });
    expect(body.user.password).toBeUndefined(); // password must NOT be exposed
  });

  it("201 — role=admin is persisted when explicitly passed", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(MOCK_ADMIN as never);

    const res = await signupPOST(
      req({ email: "admin@test.com", password: "secret123", role: "admin" })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user.role).toBe("admin");
  });

  it("201 — unknown role defaults to 'user'", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(MOCK_USER as never);

    const res = await signupPOST(
      req({ email: "arjun@test.com", password: "secret123", role: "superuser" })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user.role).toBe("user");
  });

  it("201 — password is hashed before saving (bcrypt.hash called)", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(MOCK_USER as never);

    await signupPOST(req({ email: "arjun@test.com", password: "secret123" }));

    expect(mockBcryptHash).toHaveBeenCalledWith("secret123", 10);
  });

  // ── Conflict ─────────────────────────────────────────────────────────────────

  it("409 — duplicate email returns conflict", async () => {
    mockUserFindUnique.mockResolvedValue(MOCK_USER as never);

    const res = await signupPOST(req({ email: "arjun@test.com", password: "secret123" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/already registered/i);
  });

  // ── Validation failures ───────────────────────────────────────────────────────

  it("400 — missing email", async () => {
    const res = await signupPOST(req({ password: "secret123" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — missing password", async () => {
    const res = await signupPOST(req({ email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — empty string email", async () => {
    const res = await signupPOST(req({ email: "", password: "secret123" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — invalid email format (no @)", async () => {
    const res = await signupPOST(req({ email: "notanemail", password: "secret123" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/invalid email/i);
  });

  it("400 — invalid email format (missing domain)", async () => {
    const res = await signupPOST(req({ email: "user@", password: "secret123" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/invalid email/i);
  });

  it("400 — password shorter than 6 characters", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await signupPOST(req({ email: "arjun@test.com", password: "abc" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/at least 6/i);
  });

  it("400 — password exactly 5 characters (boundary)", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await signupPOST(req({ email: "arjun@test.com", password: "12345" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  // ── Server error ──────────────────────────────────────────────────────────────

  it("500 — DB crash returns internal server error", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockRejectedValue(new Error("DB down") as never);

    const res = await signupPOST(req({ email: "arjun@test.com", password: "secret123" }));
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
