/**
 * Unit tests — recording finalize + auto-end sweep + rate-limit
 *   O12 (server side) recording start/stop finalize + failure → failed row
 *   Phase 3 auto-end stale sweep + Phase 8 stuck-processing guard
 *   L10 in-memory rate limiter
 *
 * Mocked prisma + chime + recording lib + s3 (no real DB / AWS).
 */

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    liveClass: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    liveParticipant: { updateMany: jest.fn() },
    liveRecording: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock("@/app/lib/live/chime", () => ({
  deleteChimeMeeting: jest.fn(),
}));

jest.mock("@/app/lib/live/recording", () => ({
  startMediaCapture: jest.fn(),
  stopMediaCapture: jest.fn(),
}));

jest.mock("@/app/lib/live/live-permissions", () => ({
  isCourseInstructor: jest.fn(),
  resolveJoinAccess: jest.fn(),
}));

jest.mock("@/app/lib/s3", () => ({
  getSignedFileUrl: jest.fn().mockResolvedValue("https://signed/url"),
  getSignedFileUrlFromUrl: jest.fn(),
  getS3KeyFromUrl: jest.fn(),
}));

import { prisma } from "@/app/lib/prisma";
import { startMediaCapture, stopMediaCapture } from "@/app/lib/live/recording";
import { deleteChimeMeeting } from "@/app/lib/live/chime";
import { startRecording, stopRecording, autoEndStaleClasses } from "@/app/lib/live/live-service";
import { checkRateLimit } from "@/app/lib/live/rate-limit";

const mFindClass = prisma.liveClass.findUnique as jest.MockedFunction<typeof prisma.liveClass.findUnique>;
const mFindManyClass = prisma.liveClass.findMany as jest.MockedFunction<typeof prisma.liveClass.findMany>;
const mUpdateClass = prisma.liveClass.update as jest.MockedFunction<typeof prisma.liveClass.update>;
const mFindRec = prisma.liveRecording.findFirst as jest.MockedFunction<typeof prisma.liveRecording.findFirst>;
const mCreateRec = prisma.liveRecording.create as jest.MockedFunction<typeof prisma.liveRecording.create>;
const mUpdateRec = prisma.liveRecording.update as jest.MockedFunction<typeof prisma.liveRecording.update>;
const mFindManyRec = prisma.liveRecording.findMany as jest.MockedFunction<typeof prisma.liveRecording.findMany>;
const mUpdateManyPart = prisma.liveParticipant.updateMany as jest.MockedFunction<typeof prisma.liveParticipant.updateMany>;
const mStartCapture = startMediaCapture as jest.MockedFunction<typeof startMediaCapture>;
const mStopCapture = stopMediaCapture as jest.MockedFunction<typeof stopMediaCapture>;
const mDeleteMeeting = deleteChimeMeeting as jest.MockedFunction<typeof deleteChimeMeeting>;

const HOST = "host-1";

function liveClass(over: Record<string, unknown> = {}) {
  return {
    id: "class-1", courseId: "course-1", hostUserId: HOST, chimeMeetingId: "chime-1",
    status: "live", startedAt: new Date(), ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mUpdateManyPart.mockResolvedValue({ count: 0 } as never);
});

// ═════════════════════════════════════════════════════════════════════════════
// startRecording — failure path (J7 / J9)
// ═════════════════════════════════════════════════════════════════════════════

describe("startRecording()", () => {
  it("records a 'failed' row + returns 502 when the pipeline can't start", async () => {
    mFindClass.mockResolvedValue(liveClass() as never);
    mFindRec.mockResolvedValue(null as never); // no active recording
    mStartCapture.mockRejectedValue(new Error("AWS AccessDenied"));
    mCreateRec.mockResolvedValue({ id: "r-fail" } as never);

    const r = await startRecording({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(502);
    expect(mCreateRec).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }));
  });

  it("creates a processing row on success", async () => {
    mFindClass.mockResolvedValue(liveClass() as never);
    mFindRec.mockResolvedValue(null as never);
    mStartCapture.mockResolvedValue({ pipelineId: "pl-1", s3Bucket: "b", s3Key: "k", status: "Initializing" } as never);
    mCreateRec.mockResolvedValue({ id: "r-1", liveClassId: "class-1", status: "processing", duration: null, createdAt: new Date(), s3Key: "k" } as never);

    const r = await startRecording({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.status).toBe("processing");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// stopRecording — finalize (O12 / M6)
// ═════════════════════════════════════════════════════════════════════════════

describe("stopRecording()", () => {
  it("finalizes the active recording → ready + stops pipeline + stamps duration + recordingUrl", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: HOST } as never);
    const createdAt = new Date(Date.now() - 65_000); // ~65s ago
    mFindRec.mockResolvedValue({ id: "r-1", liveClassId: "class-1", status: "processing", pipelineId: "pl-1", s3Key: "k", createdAt } as never);
    mUpdateRec.mockResolvedValue({ id: "r-1", liveClassId: "class-1", status: "ready", duration: 65, createdAt, s3Key: "k" } as never);
    mUpdateClass.mockResolvedValue({ id: "class-1" } as never);

    const r = await stopRecording({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(mStopCapture).toHaveBeenCalledWith("pl-1");
    expect(mUpdateRec).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ready", duration: expect.any(Number) }) })
    );
    expect(mUpdateClass).toHaveBeenCalledWith(expect.objectContaining({ data: { recordingUrl: "k" } }));
  });

  it("409 when there is no active recording", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: HOST } as never);
    mFindRec.mockResolvedValue(null as never);
    const r = await stopRecording({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// autoEndStaleClasses — Phase 3 sweep + Phase 8 stuck-recording guard
// ═════════════════════════════════════════════════════════════════════════════

describe("autoEndStaleClasses()", () => {
  it("ends a stale live class (Chime deleted + status ended) and finalizes stuck recordings", async () => {
    // one stale live class (stale query), and ended-class lookup for the guard
    (mFindManyClass as unknown as jest.Mock).mockImplementation((args: { where?: { status?: { in?: string[] } } }) => {
      const status = args?.where?.status;
      // the stuck-guard queries with status.in (['ended','cancelled']); the
      // stale-sweep queries with status === 'live' (not an `in`).
      if (status && status.in) {
        return Promise.resolve([{ id: "class-1" }]);
      }
      return Promise.resolve([{ id: "class-1", chimeMeetingId: "chime-1" }]);
    });
    mUpdateClass.mockResolvedValue({ id: "class-1", status: "ended" } as never);
    // _endClassRow also tries to finalize an active recording:
    mFindRec.mockResolvedValue(null as never);
    // stuck-recording guard: one processing recording whose class is ended
    mFindManyRec.mockResolvedValue([{ id: "r-stuck", liveClassId: "class-1" }] as never);

    const ended = await autoEndStaleClasses({ force: true });
    expect(ended).toBe(1);
    expect(mDeleteMeeting).toHaveBeenCalled();
  });

  it("is throttled: a non-forced immediate 2nd call does nothing", async () => {
    mFindManyClass.mockResolvedValue([] as never);
    mFindManyRec.mockResolvedValue([] as never);
    await autoEndStaleClasses({ force: true }); // sets _lastSweepAt = now
    const ended = await autoEndStaleClasses(); // immediately after → throttled
    expect(ended).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// rate-limit util (L10)
// ═════════════════════════════════════════════════════════════════════════════

describe("checkRateLimit()", () => {
  it("allows up to the limit then blocks", () => {
    const key = "user-A:chat";
    const limit = 3;
    const win = 10_000;
    expect(checkRateLimit(key, limit, win).allowed).toBe(true);  // 1
    expect(checkRateLimit(key, limit, win).allowed).toBe(true);  // 2
    expect(checkRateLimit(key, limit, win).allowed).toBe(true);  // 3
    const blocked = checkRateLimit(key, limit, win);             // 4 → over
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates different keys from each other", () => {
    expect(checkRateLimit("user-B:join", 1, 10_000).allowed).toBe(true);
    expect(checkRateLimit("user-B:join", 1, 10_000).allowed).toBe(false);
    // a different user/action is unaffected
    expect(checkRateLimit("user-C:join", 1, 10_000).allowed).toBe(true);
  });

  it("starts a fresh window after it expires", () => {
    const key = "user-D:chat";
    expect(checkRateLimit(key, 1, 1).allowed).toBe(true);  // window = 1ms
    // wait past the window
    const until = Date.now() + 5;
    while (Date.now() < until) { /* busy-wait a few ms */ }
    expect(checkRateLimit(key, 1, 1).allowed).toBe(true);  // new window
  });
});
