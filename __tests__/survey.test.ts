/**
 * Unit tests — POST /api/survey/lead & POST /api/survey/submit
 *
 * Mocks:  prisma, app/lib/mail (sendEmail)
 * No real DB, no real email sending.
 */

import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    surveyLead: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    surveyResponse: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/app/lib/mail", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { prisma } from "@/app/lib/prisma";
import { sendEmail } from "@/app/lib/mail";
import { POST as leadPOST } from "@/app/api/survey/lead/route";
import { POST as submitPOST } from "@/app/api/survey/submit/route";

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mockLeadFindUnique = prisma.surveyLead.findUnique as jest.MockedFunction<
  typeof prisma.surveyLead.findUnique
>;
const mockLeadCreate = prisma.surveyLead.create as jest.MockedFunction<
  typeof prisma.surveyLead.create
>;
const mockResponseCreate = prisma.surveyResponse.create as jest.MockedFunction<
  typeof prisma.surveyResponse.create
>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const MOCK_LEAD = { id: "lead-uuid-1", name: "Arjun", email: "arjun@test.com", createdAt: new Date() };
const MOCK_RESPONSE = { id: "resp-uuid-1", email: "arjun@test.com", answers: {}, result: "backend-nodejs", createdAt: new Date() };

// ─── Helper ───────────────────────────────────────────────────────────────────

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/survey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/survey/lead
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/survey/lead", () => {
  // ── Happy paths ─────────────────────────────────────────────────────────────

  it("201 — valid input saves lead and returns leadId", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);

    const res = await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.leadId).toBe("lead-uuid-1");
  });

  it("201 — email is normalised to lowercase before saving", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);

    await leadPOST(req({ name: "Arjun", email: "ARJUN@TEST.COM" }));

    expect(mockLeadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "arjun@test.com" }) })
    );
  });

  it("201 — sendEmail is called after lead is saved", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);

    await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));

    expect(mockSendEmail).toHaveBeenCalledWith(
      "arjun@test.com",
      expect.stringContaining("Welcome"),
      expect.any(String)
    );
  });

  it("201 — email failure does NOT break the API response", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const res = await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));

    expect(res.status).toBe(201);
  });

  it("201 — name with extra whitespace is trimmed", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);

    await leadPOST(req({ name: "  Arjun  ", email: "arjun@test.com" }));

    expect(mockLeadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Arjun" }) })
    );
  });

  // ── Conflict ─────────────────────────────────────────────────────────────────

  it("409 — duplicate email returns conflict", async () => {
    mockLeadFindUnique.mockResolvedValue(MOCK_LEAD as never);

    const res = await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/already registered/i);
  });

  // ── Validation failures ───────────────────────────────────────────────────────

  it("400 — missing name", async () => {
    const res = await leadPOST(req({ email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — missing email", async () => {
    const res = await leadPOST(req({ name: "Arjun" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/required/i);
  });

  it("400 — name is empty string", async () => {
    const res = await leadPOST(req({ name: "", email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — name is only whitespace", async () => {
    const res = await leadPOST(req({ name: "   ", email: "arjun@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — invalid email format", async () => {
    const res = await leadPOST(req({ name: "Arjun", email: "not-an-email" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/invalid email/i);
  });

  it("400 — email missing domain extension", async () => {
    const res = await leadPOST(req({ name: "Arjun", email: "arjun@test" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — both fields empty", async () => {
    const res = await leadPOST(req({ name: "", email: "" }));
    expect(res.status).toBe(400);
  });

  // ── Server error ──────────────────────────────────────────────────────────────

  it("500 — DB crash on create returns 500", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockRejectedValue(new Error("DB crash") as never);

    const res = await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toMatch(/internal server error/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/survey/submit
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/survey/submit", () => {
  // ── Happy paths — recommendation engine ──────────────────────────────────────

  it("200 — backend answers recommend backend-nodejs", async () => {
    mockResponseCreate.mockResolvedValue(MOCK_RESPONSE as never);

    const res = await submitPOST(
      req({ email: "a@test.com", answers: { goal: "backend", interest: "node" } })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recommendation.id).toBe("backend-nodejs");
    expect(body.responseId).toBe("resp-uuid-1");
  });

  it("200 — data/python answers recommend data-science", async () => {
    mockResponseCreate.mockResolvedValue({ ...MOCK_RESPONSE, result: "data-science" } as never);

    const res = await submitPOST(
      req({ email: "b@test.com", answers: { goal: "data", interest: "python" } })
    );
    const body = await res.json();

    expect(body.recommendation.id).toBe("data-science");
  });

  it("200 — fullstack/advanced answers recommend fullstack-pro", async () => {
    mockResponseCreate.mockResolvedValue({ ...MOCK_RESPONSE, result: "fullstack-pro" } as never);

    const res = await submitPOST(
      req({ email: "c@test.com", answers: { goal: "fullstack", experience: "advanced" } })
    );
    const body = await res.json();

    expect(body.recommendation.id).toBe("fullstack-pro");
  });

  it("200 — react/frontend answers recommend react-nextjs", async () => {
    mockResponseCreate.mockResolvedValue({ ...MOCK_RESPONSE, result: "react-nextjs" } as never);

    const res = await submitPOST(
      req({ email: "d@test.com", answers: { goal: "frontend", interest: "react" } })
    );
    const body = await res.json();

    expect(body.recommendation.id).toBe("react-nextjs");
  });

  it("200 — unknown answers default to web-fundamentals", async () => {
    mockResponseCreate.mockResolvedValue({ ...MOCK_RESPONSE, result: "web-fundamentals" } as never);

    const res = await submitPOST(
      req({ email: "e@test.com", answers: { goal: "something random" } })
    );
    const body = await res.json();

    expect(body.recommendation.id).toBe("web-fundamentals");
  });

  it("200 — recommendation object has required fields (id, title, description, level)", async () => {
    mockResponseCreate.mockResolvedValue(MOCK_RESPONSE as never);

    const res = await submitPOST(
      req({ email: "f@test.com", answers: { goal: "backend" } })
    );
    const body = await res.json();

    expect(body.recommendation).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      description: expect.any(String),
      level: expect.any(String),
    });
  });

  it("200 — email is normalised to lowercase", async () => {
    mockResponseCreate.mockResolvedValue(MOCK_RESPONSE as never);

    await submitPOST(req({ email: "TEST@EXAMPLE.COM", answers: { goal: "web" } }));

    expect(mockResponseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "test@example.com" }) })
    );
  });

  it("200 — email send failure does NOT break the response", async () => {
    mockResponseCreate.mockResolvedValue(MOCK_RESPONSE as never);
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));

    const res = await submitPOST(
      req({ email: "a@test.com", answers: { goal: "backend" } })
    );

    expect(res.status).toBe(200);
  });

  // ── Validation failures ───────────────────────────────────────────────────────

  it("400 — missing email", async () => {
    const res = await submitPOST(req({ answers: { goal: "web" } }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/email is required/i);
  });

  it("400 — empty email string", async () => {
    const res = await submitPOST(req({ email: "", answers: { goal: "web" } }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — invalid email format", async () => {
    const res = await submitPOST(req({ email: "bad-email", answers: { goal: "web" } }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/invalid email/i);
  });

  it("400 — answers is an array", async () => {
    const res = await submitPOST(req({ email: "a@test.com", answers: ["web"] }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toMatch(/valid json object/i);
  });

  it("400 — answers is a string", async () => {
    const res = await submitPOST(req({ email: "a@test.com", answers: "web" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — answers is null", async () => {
    const res = await submitPOST(req({ email: "a@test.com", answers: null }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it("400 — answers missing entirely", async () => {
    const res = await submitPOST(req({ email: "a@test.com" }));
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  // ── Server error ──────────────────────────────────────────────────────────────

  it("500 — DB crash on create returns 500", async () => {
    mockResponseCreate.mockRejectedValue(new Error("DB crash") as never);

    const res = await submitPOST(
      req({ email: "a@test.com", answers: { goal: "backend" } })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toMatch(/internal server error/i);
  });
});
