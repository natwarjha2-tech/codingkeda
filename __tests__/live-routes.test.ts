/**
 * Unit tests — live route handlers (O14 — HTTP boundary)
 *
 * Confirms the routes wire guards correctly: feature-off 503, unauthorized 401,
 * and success delegating to the service. Service + config + auth are mocked so
 * this layer is tested in isolation (no real DB / AWS).
 */

import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/live/live-config", () => ({
  isLiveClassConfigured: jest.fn(),
}));

jest.mock("@/app/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("@/app/lib/live/live-service", () => ({
  joinLiveClass: jest.fn(),
  getLiveClass: jest.fn(),
  updateLiveClass: jest.fn(),
}));

jest.mock("@/app/lib/live/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, retryAfterMs: 0 })),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { isLiveClassConfigured } from "@/app/lib/live/live-config";
import { verifyToken } from "@/app/lib/auth";
import { joinLiveClass, updateLiveClass } from "@/app/lib/live/live-service";
import { checkRateLimit } from "@/app/lib/live/rate-limit";
import { POST as joinPOST } from "@/app/api/live/classes/[id]/join/route";
import { PATCH as classPATCH } from "@/app/api/live/classes/[id]/route";

const mConfigured = isLiveClassConfigured as jest.MockedFunction<typeof isLiveClassConfigured>;
const mVerify = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mJoin = joinLiveClass as jest.MockedFunction<typeof joinLiveClass>;
const mUpdate = updateLiveClass as jest.MockedFunction<typeof updateLiveClass>;
const mRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function req(path: string, method: string, body?: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost" + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  mRate.mockReturnValue({ allowed: true, retryAfterMs: 0 });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/live/classes/[id]/join
// ═════════════════════════════════════════════════════════════════════════════

describe("POST join route", () => {
  it("503 when the feature is not configured", async () => {
    mConfigured.mockReturnValue(false);
    const res = await joinPOST(req("/api/live/classes/c1/join", "POST", {}, "t"), params("c1"));
    expect(res.status).toBe(503);
  });

  it("401 when unauthorized", async () => {
    mConfigured.mockReturnValue(true);
    mVerify.mockImplementation(() => { throw new Error("bad token"); });
    const res = await joinPOST(req("/api/live/classes/c1/join", "POST", {}), params("c1"));
    expect(res.status).toBe(401);
  });

  it("429 when rate-limited", async () => {
    mConfigured.mockReturnValue(true);
    mVerify.mockReturnValue({ userId: "u1", email: "u@x.com", role: "user" });
    mRate.mockReturnValue({ allowed: false, retryAfterMs: 5000 });
    const res = await joinPOST(req("/api/live/classes/c1/join", "POST", {}, "t"), params("c1"));
    expect(res.status).toBe(429);
    expect(mJoin).not.toHaveBeenCalled();
  });

  it("200 success → delegates to the service + returns meeting/attendee", async () => {
    mConfigured.mockReturnValue(true);
    mVerify.mockReturnValue({ userId: "u1", email: "u@x.com", role: "user" });
    mJoin.mockResolvedValue({
      ok: true, status: 200,
      data: { liveClass: { id: "c1" } as never, meeting: { MeetingId: "m" }, attendee: { AttendeeId: "a" } },
    });
    const res = await joinPOST(req("/api/live/classes/c1/join", "POST", { clientType: "STUDENT_DESKTOP" }, "t"), params("c1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meeting).toMatchObject({ MeetingId: "m" });
    expect(mJoin).toHaveBeenCalledWith(expect.objectContaining({ requesterId: "u1", liveClassId: "c1" }));
  });

  it("maps a service failure status through", async () => {
    mConfigured.mockReturnValue(true);
    mVerify.mockReturnValue({ userId: "u1", email: "u@x.com", role: "user" });
    mJoin.mockResolvedValue({ ok: false, status: 409, message: "This class is not live yet." });
    const res = await joinPOST(req("/api/live/classes/c1/join", "POST", {}, "t"), params("c1"));
    expect(res.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/live/classes/[id]  (edit — A10)
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH class route (edit)", () => {
  it("503 when not configured", async () => {
    mConfigured.mockReturnValue(false);
    const res = await classPATCH(req("/api/live/classes/c1", "PATCH", { title: "New" }, "t"), params("c1"));
    expect(res.status).toBe(503);
  });

  it("401 when unauthorized", async () => {
    mConfigured.mockReturnValue(true);
    mVerify.mockImplementation(() => { throw new Error("bad token"); });
    const res = await classPATCH(req("/api/live/classes/c1", "PATCH", { title: "New" }), params("c1"));
    expect(res.status).toBe(401);
  });

  it("200 success → delegates to updateLiveClass", async () => {
    mConfigured.mockReturnValue(true);
    mVerify.mockReturnValue({ userId: "host-1", email: "h@x.com", role: "user" });
    mUpdate.mockResolvedValue({ ok: true, status: 200, data: { id: "c1", title: "New" } as never });
    const res = await classPATCH(req("/api/live/classes/c1", "PATCH", { title: "New" }, "t"), params("c1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mUpdate).toHaveBeenCalledWith(expect.objectContaining({ requesterId: "host-1", liveClassId: "c1", title: "New" }));
  });

  it("403 mapped from the service when a non-instructor edits", async () => {
    mConfigured.mockReturnValue(true);
    mVerify.mockReturnValue({ userId: "stu-1", email: "s@x.com", role: "user" });
    mUpdate.mockResolvedValue({ ok: false, status: 403, message: "Only the instructor can edit this class." });
    const res = await classPATCH(req("/api/live/classes/c1", "PATCH", { title: "New" }, "t"), params("c1"));
    expect(res.status).toBe(403);
  });
});
