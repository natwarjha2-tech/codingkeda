/**
 * Unit tests — app/lib/live/live-service.ts  (lifecycle)
 *
 * Covers the live-class lifecycle logic deterministically with mocked prisma +
 * Chime + permissions + notifications (no real DB / no AWS):
 *   O9  join / leave / rejoin flows + no-duplicate on rejoin
 *   O13 end-to-end create → start → join → leave → end sequence
 *   O14 error + permission-denied branches (403 / 409 / 404 / 400)
 *
 * Mirrors the repo's established mock pattern (see student.test.ts).
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    liveClass: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    liveParticipant: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    liveRecording: { findFirst: jest.fn() },
    course: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock("@/app/lib/live/chime", () => ({
  createChimeMeeting: jest.fn(),
  createChimeAttendee: jest.fn(),
  deleteChimeMeeting: jest.fn(),
  getChimeMeeting: jest.fn(),
}));

jest.mock("@/app/lib/live/live-permissions", () => ({
  isCourseInstructor: jest.fn(),
  resolveJoinAccess: jest.fn(),
}));

jest.mock("@/app/lib/notification", () => ({
  notifyLiveClassScheduled: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/repositories/enrollment.repository", () => ({
  getEnrolledCourseIds: jest.fn().mockResolvedValue([]),
  getUsersEnrolledInCourse: jest.fn().mockResolvedValue([]),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { prisma } from "@/app/lib/prisma";
import {
  createChimeMeeting,
  createChimeAttendee,
  deleteChimeMeeting,
  getChimeMeeting,
} from "@/app/lib/live/chime";
import { isCourseInstructor, resolveJoinAccess } from "@/app/lib/live/live-permissions";
import {
  startLiveClass,
  joinLiveClass,
  leaveLiveClass,
  endLiveClass,
} from "@/app/lib/live/live-service";

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mFindClass = prisma.liveClass.findUnique as jest.MockedFunction<typeof prisma.liveClass.findUnique>;
const mUpdateClass = prisma.liveClass.update as jest.MockedFunction<typeof prisma.liveClass.update>;
const mFindPart = prisma.liveParticipant.findUnique as jest.MockedFunction<typeof prisma.liveParticipant.findUnique>;
const mUpsertPart = prisma.liveParticipant.upsert as jest.MockedFunction<typeof prisma.liveParticipant.upsert>;
const mUpdatePart = prisma.liveParticipant.update as jest.MockedFunction<typeof prisma.liveParticipant.update>;
const mUpdateManyPart = prisma.liveParticipant.updateMany as jest.MockedFunction<typeof prisma.liveParticipant.updateMany>;
const mFindRec = prisma.liveRecording.findFirst as jest.MockedFunction<typeof prisma.liveRecording.findFirst>;

const mCreateMeeting = createChimeMeeting as jest.MockedFunction<typeof createChimeMeeting>;
const mCreateAttendee = createChimeAttendee as jest.MockedFunction<typeof createChimeAttendee>;
const mDeleteMeeting = deleteChimeMeeting as jest.MockedFunction<typeof deleteChimeMeeting>;
const mGetMeeting = getChimeMeeting as jest.MockedFunction<typeof getChimeMeeting>;
const mIsInstructor = isCourseInstructor as jest.MockedFunction<typeof isCourseInstructor>;
const mResolveJoin = resolveJoinAccess as jest.MockedFunction<typeof resolveJoinAccess>;

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const HOST = "host-1";
const STUDENT = "stu-1";

function classRow(over: Record<string, unknown> = {}) {
  return {
    id: "class-1",
    courseId: "course-1",
    hostUserId: HOST,
    chimeMeetingId: "chime-1",
    mediaRegion: "ap-south-1",
    title: "Live",
    instructorName: "Teacher",
    durationMinutes: 60,
    agenda: "",
    status: "live",
    scheduledAt: null,
    startedAt: new Date("2025-01-01T10:00:00Z"),
    endedAt: null,
    hostLastSeenAt: new Date(),
    recordingUrl: null,
    createdAt: new Date("2025-01-01T09:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mFindRec.mockResolvedValue(null as never); // no active recording by default
  mUpdateManyPart.mockResolvedValue({ count: 0 } as never);
});

// ═════════════════════════════════════════════════════════════════════════════
// startLiveClass
// ═════════════════════════════════════════════════════════════════════════════

describe("startLiveClass()", () => {
  it("404 when class not found", async () => {
    mFindClass.mockResolvedValue(null as never);
    const r = await startLiveClass({ requesterId: HOST, liveClassId: "x" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
  });

  it("403 when caller is neither host nor instructor", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "scheduled" }) as never);
    mIsInstructor.mockResolvedValue(false);
    const r = await startLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(r.status).toBe(403);
  });

  it("409 when class already ended", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "ended" }) as never);
    const r = await startLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.status).toBe(409);
  });

  it("host starts a scheduled class → Chime meeting created + status live", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "scheduled", chimeMeetingId: "" }) as never);
    mCreateMeeting.mockResolvedValue({ MeetingId: "chime-new", MediaRegion: "ap-south-1" } as never);
    mUpdateClass.mockResolvedValue(classRow({ status: "live", chimeMeetingId: "chime-new" }) as never);

    const r = await startLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(mCreateMeeting).toHaveBeenCalledWith("class-1");
    expect(r.data!.liveClass.status).toBe("live");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// joinLiveClass
// ═════════════════════════════════════════════════════════════════════════════

describe("joinLiveClass()", () => {
  it("409 when class is not live", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "scheduled" }) as never);
    const r = await joinLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(r.status).toBe(409);
  });

  it("403 when access is denied", async () => {
    mFindClass.mockResolvedValue(classRow() as never);
    mResolveJoin.mockResolvedValue({ allowed: false, role: "student" });
    const r = await joinLiveClass({ requesterId: "outsider", liveClassId: "class-1" });
    expect(r.status).toBe(403);
  });

  it("403 when a removed student tries to join", async () => {
    mFindClass.mockResolvedValue(classRow() as never);
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindPart.mockResolvedValue({ removed: true } as never);
    const r = await joinLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(r.status).toBe(403);
  });

  it("409 when the Chime meeting no longer exists", async () => {
    mFindClass.mockResolvedValue(classRow() as never);
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindPart.mockResolvedValue({ removed: false } as never);
    mGetMeeting.mockResolvedValue(null);
    const r = await joinLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(r.status).toBe(409);
  });

  it("happy path → upsert (no duplicate on rejoin) + returns meeting + attendee", async () => {
    mFindClass.mockResolvedValue(classRow() as never);
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindPart.mockResolvedValue({ removed: false } as never);
    mGetMeeting.mockResolvedValue({ MeetingId: "chime-1" } as never);
    mCreateAttendee.mockResolvedValue({ AttendeeId: "att-1", JoinToken: "jt-1" } as never);
    mUpsertPart.mockResolvedValue({ id: "p-1" } as never);

    const r = await joinLiveClass({ requesterId: STUDENT, liveClassId: "class-1", clientType: "STUDENT_DESKTOP" });
    expect(r.ok).toBe(true);
    // Rejoin safety: a single upsert keyed on (class,user) — never a 2nd row.
    expect(mUpsertPart).toHaveBeenCalledTimes(1);
    expect(r.data!.attendee).toMatchObject({ AttendeeId: "att-1" });
    expect(r.data!.meeting).toMatchObject({ MeetingId: "chime-1" });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// leaveLiveClass
// ═════════════════════════════════════════════════════════════════════════════

describe("leaveLiveClass()", () => {
  it("{left:false} when the user never joined", async () => {
    mFindClass.mockResolvedValue({ id: "class-1" } as never);
    mFindPart.mockResolvedValue(null as never);
    const r = await leaveLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.left).toBe(false);
  });

  it("sets leftAt when present", async () => {
    mFindClass.mockResolvedValue({ id: "class-1" } as never);
    mFindPart.mockResolvedValue({ id: "p-1", leftAt: null } as never);
    mUpdatePart.mockResolvedValue({ id: "p-1" } as never);
    const r = await leaveLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(r.data!.left).toBe(true);
    expect(mUpdatePart).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// endLiveClass
// ═════════════════════════════════════════════════════════════════════════════

describe("endLiveClass()", () => {
  it("403 when caller is not host/instructor", async () => {
    mFindClass.mockResolvedValue(classRow() as never);
    mIsInstructor.mockResolvedValue(false);
    const r = await endLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(r.status).toBe(403);
  });

  it("idempotent success when already ended", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "ended" }) as never);
    const r = await endLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(mDeleteMeeting).not.toHaveBeenCalled();
  });

  it("host ends a live class → Chime deleted + status ended + participants closed", async () => {
    mFindClass.mockResolvedValue(classRow() as never);
    mUpdateClass.mockResolvedValue(classRow({ status: "ended", endedAt: new Date() }) as never);

    const r = await endLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(mDeleteMeeting).toHaveBeenCalledWith("chime-1");
    expect(mUpdateManyPart).toHaveBeenCalled(); // close out present participants
    expect(r.data!.status).toBe("ended");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E2E lifecycle sequence (O13): create-ish → start → join → leave → end
// ═════════════════════════════════════════════════════════════════════════════

describe("lifecycle sequence (O13)", () => {
  it("runs start → join → leave → end with consistent state transitions", async () => {
    // start
    mFindClass.mockResolvedValueOnce(classRow({ status: "scheduled", chimeMeetingId: "" }) as never);
    mCreateMeeting.mockResolvedValue({ MeetingId: "chime-1", MediaRegion: "ap-south-1" } as never);
    mUpdateClass.mockResolvedValueOnce(classRow({ status: "live" }) as never);
    const started = await startLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(started.data!.liveClass.status).toBe("live");

    // join
    mFindClass.mockResolvedValueOnce(classRow() as never);
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindPart.mockResolvedValueOnce({ removed: false } as never);
    mGetMeeting.mockResolvedValue({ MeetingId: "chime-1" } as never);
    mCreateAttendee.mockResolvedValue({ AttendeeId: "att-1", JoinToken: "jt-1" } as never);
    mUpsertPart.mockResolvedValue({ id: "p-1" } as never);
    const joined = await joinLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(joined.ok).toBe(true);

    // leave
    mFindClass.mockResolvedValueOnce({ id: "class-1" } as never);
    mFindPart.mockResolvedValueOnce({ id: "p-1", leftAt: null } as never);
    mUpdatePart.mockResolvedValue({ id: "p-1" } as never);
    const left = await leaveLiveClass({ requesterId: STUDENT, liveClassId: "class-1" });
    expect(left.data!.left).toBe(true);

    // end
    mFindClass.mockResolvedValueOnce(classRow() as never);
    mUpdateClass.mockResolvedValueOnce(classRow({ status: "ended", endedAt: new Date() }) as never);
    const ended = await endLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(ended.data!.status).toBe("ended");
    expect(mDeleteMeeting).toHaveBeenCalled();
  });
});
