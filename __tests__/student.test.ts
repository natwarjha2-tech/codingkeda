/**
 * Unit tests — POST /api/student
 *
 * Mocks:  prisma
 * No real DB.
 */

import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    student: {
      create: jest.fn(),
    },
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { prisma } from "@/app/lib/prisma";
import { POST as studentPOST } from "@/app/api/student/route";

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mockStudentCreate = prisma.student.create as jest.MockedFunction<
  typeof prisma.student.create
>;

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const MOCK_STUDENT = {
  id: "stu-uuid-1",
  name: "Arjun",
  email: "arjun@test.com",
  phone: null,
  createdAt: new Date(),
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  // ── Happy paths ─────────────────────────────────────────────────────────────

  it("201 — valid input creates student and returns student object", async () => {
    mockStudentCreate.mockResolvedValue(MOCK_STUDENT as never);

    const res = await studentPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.student).toMatchObject({ id: "stu-uuid-1", email: "arjun@test.com" });
  });

  it("201 — optional phone is saved when provided", async () => {
    mockStudentCreate.mockResolvedValue({ ...MOCK_STUDENT, phone: "9876543210" } as never);

    const res = await studentPOST(
      req({ name: "Arjun", email: "arjun@test.com", phone: "9876543210" })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.student.phone).toBe("9876543210");
  });

  it("201 — phone defaults to null when omitted", async () => {
    mockStudentCreate.mockResolvedValue(MOCK_STUDENT as never);

    const res = await studentPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(body.student.phone).toBeNull();
  });

  it("201 — email is normalised to lowercase", async () => {
    mockStudentCreate.mockResolvedValue(MOCK_STUDENT as never);

    await studentPOST(req({ name: "Arjun", email: "ARJUN@TEST.COM" }));

    expect(mockStudentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "arjun@test.com" }) })
    );
  });

  it("201 — name is trimmed before saving", async () => {
    mockStudentCreate.mockResolvedValue(MOCK_STUDENT as never);

    await studentPOST(req({ name: "  Arjun  ", email: "arjun@test.com" }));

    expect(mockStudentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Arjun" }) })
    );
  });

  // ── Conflict ─────────────────────────────────────────────────────────────────

  it("409 — Prisma P2002 (duplicate email) returns conflict", async () => {
    mockStudentCreate.mockRejectedValue(p2002() as never);

    const res = await studentPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/already registered/i);
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
    mockStudentCreate.mockRejectedValue(new Error("Connection lost") as never);

    const res = await studentPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toMatch(/internal server error/i);
  });
});
