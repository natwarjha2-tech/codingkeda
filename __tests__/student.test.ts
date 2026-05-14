/**
 * Unit tests — POST /api/student
 *
 * Mocks:  prisma, auth
 * No real DB.
 */

import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    student: {
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/app/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { POST as studentPOST } from "@/app/api/student/route";

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mockStudentUpsert = prisma.student.upsert as jest.MockedFunction<
  typeof prisma.student.upsert
>;

const mockUserFindUnique = prisma.user.findUnique as jest.MockedFunction<
  typeof prisma.user.findUnique
>;

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-uuid-1",
  name: "Arjun",
  email: "arjun@test.com",
  password: "hashed",
  role: "user",
  createdAt: new Date(),
};

const MOCK_STUDENT = {
  id: "stu-uuid-1",
  userId: "user-uuid-1",
  name: "Arjun",
  email: "arjun@test.com",
  phone: null,
  enrolledCourses: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function req(body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/student", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// ─── Prisma P2002 error factory ───────────────────────────────────────────────

function p2002(): Error {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/student
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/student", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy paths (with token) ────────────────────────────────────────────────

  it("201 — authenticated user creates student record", async () => {
    mockVerifyToken.mockReturnValue({ userId: "user-uuid-1", email: "arjun@test.com", role: "user" });
    mockStudentUpsert.mockResolvedValue(MOCK_STUDENT as never);

    const res = await studentPOST(req({ name: "Arjun", email: "arjun@test.com" }, "valid-token"));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.student).toMatchObject({ id: "stu-uuid-1", email: "arjun@test.com" });
  });

  it("201 — optional phone is saved when provided", async () => {
    mockVerifyToken.mockReturnValue({ userId: "user-uuid-1", email: "arjun@test.com", role: "user" });
    mockStudentUpsert.mockResolvedValue({ ...MOCK_STUDENT, phone: "9876543210" } as never);

    const res = await studentPOST(
      req({ name: "Arjun", email: "arjun@test.com", phone: "9876543210" }, "valid-token")
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.student.phone).toBe("9876543210");
  });

  // ── Happy paths (without token — fallback to email lookup) ──────────────────

  it("201 — without token, finds user by email and creates student", async () => {
    mockUserFindUnique.mockResolvedValue(MOCK_USER as never);
    mockStudentUpsert.mockResolvedValue(MOCK_STUDENT as never);

    const res = await studentPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("400 — without token, no user found by email returns error", async () => {
    mockUserFindUnique.mockResolvedValue(null as never);

    const res = await studentPOST(req({ name: "Arjun", email: "unknown@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toMatch(/sign up/i);
  });

  // ── Conflict ─────────────────────────────────────────────────────────────────

  it("409 — Prisma P2002 (duplicate) returns conflict", async () => {
    mockVerifyToken.mockReturnValue({ userId: "user-uuid-1", email: "arjun@test.com", role: "user" });
    mockStudentUpsert.mockRejectedValue(p2002() as never);

    const res = await studentPOST(req({ name: "Arjun", email: "arjun@test.com" }, "valid-token"));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
  });

  // ── Validation failures ───────────────────────────────────────────────────────

  it("400 — missing name", async () => {
    const res = await studentPOST(req({ email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — missing email", async () => {
    const res = await studentPOST(req({ name: "Arjun" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — name is empty string", async () => {
    const res = await studentPOST(req({ name: "", email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — name is only whitespace", async () => {
    const res = await studentPOST(req({ name: "   ", email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — invalid email format", async () => {
    const res = await studentPOST(req({ name: "Arjun", email: "bad-email" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/invalid email/i);
  });

  it("400 — email missing @ symbol", async () => {
    const res = await studentPOST(req({ name: "Arjun", email: "arjuntest.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — both fields missing", async () => {
    const res = await studentPOST(req({}));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  // ── Server error ──────────────────────────────────────────────────────────────

  it("500 — unexpected DB error returns 500", async () => {
    mockVerifyToken.mockReturnValue({ userId: "user-uuid-1", email: "arjun@test.com", role: "user" });
    mockStudentUpsert.mockRejectedValue(new Error("Connection lost") as never);

    const res = await studentPOST(req({ name: "Arjun", email: "arjun@test.com" }, "valid-token"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toMatch(/internal server error/i);
  });
});
