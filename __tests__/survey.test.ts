/**
 * Unit tests — POST /api/survey/lead & POST /api/survey/submit
 *
 * Production logic:
 *  - survey/lead  → saves name+email only, NO email sent
 *  - survey/submit → recommends ZenZ (class 4-8) or ZenAlpha (class 9-12),
 *                    sends recommendation email with login link
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_LEAD = {
  id: "lead-uuid-1",
  name: "Arjun",
  email: "arjun@test.com",
  createdAt: new Date(),
};

const MOCK_RESPONSE = {
  id: "resp-uuid-1",
  email: "arjun@test.com",
  answers: {},
  result: "zenz",
  createdAt: new Date(),
};

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
  beforeEach(() => {
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("201 — valid input saves lead and returns leadId", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);

    const res = await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.leadId).toBe("lead-uuid-1");
  });

  it("201 — NO email is sent on lead capture (mentor requirement)", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);

    await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("201 — email is normalised to lowercase", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);

    await leadPOST(req({ name: "Arjun", email: "ARJUN@TEST.COM" }));

    expect(mockLeadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "arjun@test.com" }) })
    );
  });

  it("201 — name is trimmed before saving", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockResolvedValue(MOCK_LEAD as never);

    await leadPOST(req({ name: "  Arjun  ", email: "arjun@test.com" }));

    expect(mockLeadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Arjun" }) })
    );
  });

  it("409 — duplicate email returns conflict", async () => {
    mockLeadFindUnique.mockResolvedValue(MOCK_LEAD as never);

    const res = await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.message).toMatch(/already registered/i);
  });

  it("400 — missing name", async () => {
    const res = await leadPOST(req({ email: "arjun@test.com" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/required/i);
  });

  it("400 — missing email", async () => {
    const res = await leadPOST(req({ name: "Arjun" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/required/i);
  });

  it("400 — name is only whitespace", async () => {
    const res = await leadPOST(req({ name: "   ", email: "arjun@test.com" }));
    expect(res.status).toBe(400);
  });

  it("400 — invalid email format", async () => {
    const res = await leadPOST(req({ name: "Arjun", email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/invalid email/i);
  });

  it("400 — both fields empty", async () => {
    const res = await leadPOST(req({ name: "", email: "" }));
    expect(res.status).toBe(400);
  });

  it("500 — DB crash returns 500", async () => {
    mockLeadFindUnique.mockResolvedValue(null);
    mockLeadCreate.mockRejectedValue(new Error("DB crash") as never);

    const res = await leadPOST(req({ name: "Arjun", email: "arjun@test.com" }));
    expect(res.status).toBe(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/survey/submit
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/survey/submit", () => {
  beforeEach(() => {
    mockSendEmail.mockResolvedValue(undefined);
    mockResponseCreate.mockResolvedValue(MOCK_RESPONSE as never);
  });

  // ── Package recommendation logic ──────────────────────────────────────────

  it("200 — class 4-8 recommends ZenZ package", async () => {
    const res = await submitPOST(
      req({ email: "a@test.com", name: "Arjun", classGroup: "4-8", experience: "Just Starting" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recommendation.id).toBe("zenz");
    expect(body.recommendation.name).toBe("ZenZ Package");
  });

  it("200 — class 9-12 recommends ZenAlpha package", async () => {
    const res = await submitPOST(
      req({ email: "b@test.com", name: "Priya", classGroup: "9-12", experience: "I Know Basics" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recommendation.id).toBe("zenalpha");
    expect(body.recommendation.name).toBe("ZenAlpha Package");
  });

  it("200 — recommendation object has required fields", async () => {
    const res = await submitPOST(
      req({ email: "c@test.com", name: "Rahul", classGroup: "4-8" })
    );
    const body = await res.json();

    expect(body.recommendation).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      level: expect.any(String),
    });
  });

  it("200 — responseId is returned", async () => {
    const res = await submitPOST(
      req({ email: "d@test.com", name: "Ankit", classGroup: "9-12" })
    );
    const body = await res.json();

    expect(body.responseId).toBe("resp-uuid-1");
  });

  it("200 — email is sent with recommendation after submit", async () => {
    await submitPOST(
      req({ email: "e@test.com", name: "Sneha", classGroup: "4-8" })
    );

    expect(mockSendEmail).toHaveBeenCalledWith(
      "e@test.com",
      expect.stringContaining("ZenZ"),
      expect.any(String)
    );
  });

  it("200 — email template contains login link", async () => {
    await submitPOST(
      req({ email: "f@test.com", name: "Raj", classGroup: "9-12" })
    );

    const htmlArg = mockSendEmail.mock.calls[0][2];
    expect(htmlArg).toContain("/login");
  });

  it("200 — email send failure does NOT break the response", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));

    const res = await submitPOST(
      req({ email: "g@test.com", name: "Raj", classGroup: "4-8" })
    );

    expect(res.status).toBe(200);
  });

  it("200 — email is normalised to lowercase", async () => {
    await submitPOST(
      req({ email: "TEST@EXAMPLE.COM", name: "Raj", classGroup: "4-8" })
    );

    expect(mockResponseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "test@example.com" }) })
    );
  });

  // ── Validation failures ───────────────────────────────────────────────────

  it("400 — missing email", async () => {
    const res = await submitPOST(req({ name: "Arjun", classGroup: "4-8" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/email is required/i);
  });

  it("400 — empty email string", async () => {
    const res = await submitPOST(req({ email: "", name: "Arjun", classGroup: "4-8" }));
    expect(res.status).toBe(400);
  });

  it("400 — invalid email format", async () => {
    const res = await submitPOST(req({ email: "bad-email", name: "Arjun", classGroup: "4-8" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/invalid email/i);
  });

  // ── Server error ──────────────────────────────────────────────────────────

  it("500 — DB crash returns 500", async () => {
    mockResponseCreate.mockRejectedValue(new Error("DB crash") as never);

    const res = await submitPOST(
      req({ email: "h@test.com", name: "Raj", classGroup: "4-8" })
    );
    expect(res.status).toBe(500);
  });
});
