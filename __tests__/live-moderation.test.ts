/**
 * Unit tests — app/lib/live/live-service.ts  (O11 — moderation state transitions)
 *
 * The AUTHORITATIVE, server-side half of mic/cam state: host bulk + per-user
 * moderation, force-remove, and the rejoin-request lifecycle. Mocked prisma +
 * permissions (no real DB). (Client button/UI transitions are browser-level and
 * covered by the runtime [VERIFY] guide.)
 */

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    liveClass: { findUnique: jest.fn() },
    liveParticipant: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock("@/app/lib/live/live-permissions", () => ({
  isCourseInstructor: jest.fn(),
  resolveJoinAccess: jest.fn(),
}));

import { prisma } from "@/app/lib/prisma";
import { isCourseInstructor } from "@/app/lib/live/live-permissions";
import {
  moderateAllParticipants,
  moderateParticipant,
  removeParticipant,
  requestRejoin,
  respondRejoin,
  listRejoinRequests,
} from "@/app/lib/live/live-service";

const mFindClass = prisma.liveClass.findUnique as jest.MockedFunction<typeof prisma.liveClass.findUnique>;
const mFindPart = prisma.liveParticipant.findUnique as jest.MockedFunction<typeof prisma.liveParticipant.findUnique>;
const mUpdatePart = prisma.liveParticipant.update as jest.MockedFunction<typeof prisma.liveParticipant.update>;
const mUpdateMany = prisma.liveParticipant.updateMany as jest.MockedFunction<typeof prisma.liveParticipant.updateMany>;
const mFindManyPart = prisma.liveParticipant.findMany as jest.MockedFunction<typeof prisma.liveParticipant.findMany>;
const mUsers = prisma.user.findMany as jest.MockedFunction<typeof prisma.user.findMany>;
const mIsInstructor = isCourseInstructor as jest.MockedFunction<typeof isCourseInstructor>;

const HOST = "host-1";
const CLASS = { id: "class-1", courseId: "course-1", hostUserId: HOST };

beforeEach(() => {
  jest.clearAllMocks();
  mFindClass.mockResolvedValue(CLASS as never);
  mUpdatePart.mockResolvedValue({ id: "p-1" } as never);
  mUpdateMany.mockResolvedValue({ count: 3 } as never);
});

// ═════════════════════════════════════════════════════════════════════════════
// moderateAllParticipants (bulk)
// ═════════════════════════════════════════════════════════════════════════════

describe("moderateAllParticipants()", () => {
  it("400 on invalid type", async () => {
    const r = await moderateAllParticipants({ requesterId: HOST, liveClassId: "class-1", type: "bogus" as never, blocked: true });
    expect(r.status).toBe(400);
  });

  it("403 when not host/instructor", async () => {
    mIsInstructor.mockResolvedValue(false);
    const r = await moderateAllParticipants({ requesterId: "stu-1", liveClassId: "class-1", type: "audio", blocked: true });
    expect(r.status).toBe(403);
  });

  it("host mutes everyone (except self) → updateMany with audioBlocked", async () => {
    const r = await moderateAllParticipants({ requesterId: HOST, liveClassId: "class-1", type: "audio", blocked: true });
    expect(r.ok).toBe(true);
    expect(mUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ liveClassId: "class-1", userId: { not: HOST } }),
        data: { audioBlocked: true },
      })
    );
    expect(r.data!.count).toBe(3);
  });

  it("supports video + chat + unblock direction", async () => {
    await moderateAllParticipants({ requesterId: HOST, liveClassId: "class-1", type: "video", blocked: false });
    expect(mUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { videoBlocked: false } }));
    await moderateAllParticipants({ requesterId: HOST, liveClassId: "class-1", type: "chat", blocked: true });
    expect(mUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { chatBlocked: true } }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// moderateParticipant (per-user)
// ═════════════════════════════════════════════════════════════════════════════

describe("moderateParticipant()", () => {
  it("400 when targeting yourself", async () => {
    const r = await moderateParticipant({ requesterId: HOST, liveClassId: "class-1", targetUserId: HOST, type: "audio", blocked: true });
    expect(r.status).toBe(400);
  });

  it("404 when the target isn't in the class", async () => {
    mFindPart.mockResolvedValue(null as never);
    const r = await moderateParticipant({ requesterId: HOST, liveClassId: "class-1", targetUserId: "stu-9", type: "audio", blocked: true });
    expect(r.status).toBe(404);
  });

  it("host disables a participant's video", async () => {
    mFindPart.mockResolvedValue({ id: "p-1" } as never);
    const r = await moderateParticipant({ requesterId: HOST, liveClassId: "class-1", targetUserId: "stu-1", type: "video", blocked: true });
    expect(r.ok).toBe(true);
    expect(mUpdatePart).toHaveBeenCalledWith(expect.objectContaining({ data: { videoBlocked: true } }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// removeParticipant + rejoin lifecycle
// ═════════════════════════════════════════════════════════════════════════════

describe("force-remove + rejoin lifecycle", () => {
  it("removeParticipant marks removed + leftAt", async () => {
    mFindPart.mockResolvedValue({ id: "p-1" } as never);
    const r = await removeParticipant({ requesterId: HOST, liveClassId: "class-1", targetUserId: "stu-1" });
    expect(r.ok).toBe(true);
    expect(mUpdatePart).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ removed: true, rejoinRequestedAt: null }) })
    );
  });

  it("requestRejoin is a no-op when the user wasn't removed", async () => {
    mFindPart.mockResolvedValue({ id: "p-1", removed: false } as never);
    const r = await requestRejoin({ requesterId: "stu-1", liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.pending).toBe(false);
    expect(mUpdatePart).not.toHaveBeenCalled();
  });

  it("requestRejoin sets rejoinRequestedAt when removed", async () => {
    mFindPart.mockResolvedValue({ id: "p-1", removed: true } as never);
    const r = await requestRejoin({ requesterId: "stu-1", liveClassId: "class-1" });
    expect(r.data!.pending).toBe(true);
    expect(mUpdatePart).toHaveBeenCalled();
  });

  it("respondRejoin accept clears removed; reject only clears the pending flag", async () => {
    mFindPart.mockResolvedValue({ id: "p-1" } as never);

    await respondRejoin({ requesterId: HOST, liveClassId: "class-1", targetUserId: "stu-1", accept: true });
    expect(mUpdatePart).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { removed: false, rejoinRequestedAt: null } })
    );

    await respondRejoin({ requesterId: HOST, liveClassId: "class-1", targetUserId: "stu-1", accept: false });
    expect(mUpdatePart).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { rejoinRequestedAt: null } })
    );
  });

  it("listRejoinRequests returns pending requests with names", async () => {
    mFindManyPart.mockResolvedValue([{ userId: "stu-1", rejoinRequestedAt: new Date() }] as never);
    mUsers.mockResolvedValue([{ id: "stu-1", name: "Student" }] as never);
    const r = await listRejoinRequests({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.requests[0]).toMatchObject({ userId: "stu-1", name: "Student" });
  });
});
