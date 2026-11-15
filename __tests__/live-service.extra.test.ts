/**
 * Unit tests — app/lib/live/live-service.ts  (non-lifecycle service functions)
 *
 * Covers the service functions NOT already tested by the lifecycle / moderation
 * / recording suites: create, list (course/student/hosting), get, cancel,
 * heartbeat, participant rosters, and recordings listing. prisma + chime +
 * permissions + notifications + s3 + enrollment repo are all mocked — no real
 * DB / AWS / network. Mirrors the repo's established mock pattern.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    liveClass: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    liveParticipant: { findUnique: jest.fn(), findMany: jest.fn() },
    liveRecording: { findMany: jest.fn() },
    course: { findUnique: jest.fn(), findMany: jest.fn() },
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

jest.mock("@/app/lib/s3", () => ({
  getSignedFileUrl: jest.fn(),
  getSignedFileUrlFromUrl: jest.fn().mockResolvedValue("https://cdn/signed.mp4"),
  getS3KeyFromUrl: jest.fn(),
  getPublicUrl: jest.fn((k: string) => `https://bucket/${k}`),
  resolveRecordingObjectKey: jest.fn().mockResolvedValue("live-recordings/c/r/final/composited-video/x.mp4"),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { prisma } from "@/app/lib/prisma";
import { isCourseInstructor, resolveJoinAccess } from "@/app/lib/live/live-permissions";
import { getEnrolledCourseIds } from "@/app/repositories/enrollment.repository";
import { getSignedFileUrlFromUrl, resolveRecordingObjectKey } from "@/app/lib/s3";
import {
  createLiveClass,
  listLiveClasses,
  listStudentClasses,
  listHostingClasses,
  cancelLiveClass,
  getLiveClass,
  recordHostHeartbeat,
  listLiveParticipants,
  listParticipants,
  listRecordings,
  listMyRecordings,
} from "@/app/lib/live/live-service";

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mFindClass = prisma.liveClass.findUnique as jest.MockedFunction<typeof prisma.liveClass.findUnique>;
const mCreateClass = prisma.liveClass.create as jest.MockedFunction<typeof prisma.liveClass.create>;
const mUpdateClass = prisma.liveClass.update as jest.MockedFunction<typeof prisma.liveClass.update>;
const mFindManyClass = prisma.liveClass.findMany as jest.MockedFunction<typeof prisma.liveClass.findMany>;
const mFindManyParticipant = prisma.liveParticipant.findMany as jest.MockedFunction<typeof prisma.liveParticipant.findMany>;
const mFindManyRec = prisma.liveRecording.findMany as jest.MockedFunction<typeof prisma.liveRecording.findMany>;
const mFindManyCourse = prisma.course.findMany as jest.MockedFunction<typeof prisma.course.findMany>;
const mUsers = prisma.user.findMany as jest.MockedFunction<typeof prisma.user.findMany>;
const mIsInstructor = isCourseInstructor as jest.MockedFunction<typeof isCourseInstructor>;
const mResolveJoin = resolveJoinAccess as jest.MockedFunction<typeof resolveJoinAccess>;
const mEnrolledCourseIds = getEnrolledCourseIds as jest.MockedFunction<typeof getEnrolledCourseIds>;
const mSign = getSignedFileUrlFromUrl as jest.MockedFunction<typeof getSignedFileUrlFromUrl>;
const mResolveKey = resolveRecordingObjectKey as jest.MockedFunction<typeof resolveRecordingObjectKey>;

const HOST = "host-1";
const classRow = (over: Record<string, unknown> = {}) => ({
  id: "class-1", courseId: "course-1", hostUserId: HOST, title: "T", instructorName: "I",
  durationMinutes: 60, agenda: "", scheduledAt: new Date(), startedAt: null, endedAt: null,
  status: "scheduled", chimeMeetingId: null, mediaRegion: "ap-south-1", recordingUrl: null,
  hostLastSeenAt: null, createdAt: new Date(), updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mEnrolledCourseIds.mockResolvedValue([]);
  // clearAllMocks() wipes the factory's mockResolvedValue too — re-arm the s3
  // signing chain each test (safeSignRecording resolves a real final/ key, then
  // signs it). A recording signs only when BOTH resolve.
  mResolveKey.mockResolvedValue("live-recordings/c/r/final/composited-video/x.mp4");
  mSign.mockResolvedValue("https://cdn/signed.mp4");
  // Default: no classes anywhere (the stale-sweep's own findMany calls return
  // nothing). Individual tests override the specific query they care about.
  mFindManyClass.mockResolvedValue([] as never);
  mFindManyRec.mockResolvedValue([] as never);
  mFindManyCourse.mockResolvedValue([] as never);
  mUsers.mockResolvedValue([] as never);
});

// ═════════════════════════════════════════════════════════════════════════════
// createLiveClass
// ═════════════════════════════════════════════════════════════════════════════

describe("createLiveClass()", () => {
  it("400 when courseId is missing", async () => {
    const r = await createLiveClass({ requesterId: HOST, courseId: "  " });
    expect(r.status).toBe(400);
  });

  it("403 when requester is not the course instructor", async () => {
    mIsInstructor.mockResolvedValue(false);
    const r = await createLiveClass({ requesterId: HOST, courseId: "course-1" });
    expect(r.status).toBe(403);
  });

  it("400 when scheduledAt is an invalid date", async () => {
    mIsInstructor.mockResolvedValue(true);
    const r = await createLiveClass({ requesterId: HOST, courseId: "course-1", scheduledAt: "not-a-date" });
    expect(r.status).toBe(400);
  });

  it("201 creates a scheduled class (and notifies enrolled)", async () => {
    mIsInstructor.mockResolvedValue(true);
    mCreateClass.mockResolvedValue(classRow({ status: "scheduled" }) as never);
    const r = await createLiveClass({
      requesterId: HOST, courseId: "course-1", title: "Intro",
      durationMinutes: 45, scheduledAt: new Date().toISOString(),
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(201);
    expect(mCreateClass).toHaveBeenCalled();
  });

  it("clamps an out-of-range duration to null", async () => {
    mIsInstructor.mockResolvedValue(true);
    mCreateClass.mockResolvedValue(classRow() as never);
    await createLiveClass({ requesterId: HOST, courseId: "course-1", durationMinutes: 99999 });
    const data = (mCreateClass.mock.calls[0][0] as { data: { durationMinutes: number | null } }).data;
    expect(data.durationMinutes).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listLiveClasses (course, instructor-only)
// ═════════════════════════════════════════════════════════════════════════════

describe("listLiveClasses()", () => {
  it("400 without courseId", async () => {
    expect((await listLiveClasses({ requesterId: HOST, courseId: "" })).status).toBe(400);
  });

  it("403 when not the instructor", async () => {
    mIsInstructor.mockResolvedValue(false);
    expect((await listLiveClasses({ requesterId: HOST, courseId: "course-1" })).status).toBe(403);
  });

  it("returns the course's classes for the instructor", async () => {
    mIsInstructor.mockResolvedValue(true);
    mFindManyClass.mockResolvedValue([classRow(), classRow({ id: "class-2" })] as never);
    const r = await listLiveClasses({ requesterId: HOST, courseId: "course-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.classes).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listStudentClasses + listHostingClasses
// ═════════════════════════════════════════════════════════════════════════════

describe("listStudentClasses()", () => {
  it("returns [] when the student has no enrolled courses", async () => {
    mFindManyClass.mockResolvedValue([] as never); // sweep query
    mEnrolledCourseIds.mockResolvedValue([]);
    const r = await listStudentClasses({ requesterId: "stu-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.classes).toEqual([]);
  });

  it("returns enrolled courses' classes with course titles", async () => {
    mEnrolledCourseIds.mockResolvedValue(["course-1"]);
    // Return the student's classes only for the course-scoped query; the
    // stale-sweep's own findMany calls (status:"live") still return []. This is
    // robust to how many internal queries the sweep makes.
    mFindManyClass.mockImplementation(((args: unknown) => {
      const where = (args as { where?: { courseId?: unknown } })?.where;
      if (where && where.courseId) return Promise.resolve([classRow({ status: "live" })]);
      return Promise.resolve([]);
    }) as never);
    mFindManyCourse.mockResolvedValue([{ id: "course-1", title: "Python" }] as never);
    const r = await listStudentClasses({ requesterId: "stu-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.classes[0].courseTitle).toBe("Python");
  });
});

describe("listHostingClasses()", () => {
  it("returns [] when the host has no live/scheduled classes", async () => {
    mFindManyClass
      .mockResolvedValueOnce([] as never) // sweep
      .mockResolvedValueOnce([] as never); // hosting list
    const r = await listHostingClasses({ requesterId: HOST });
    expect(r.ok).toBe(true);
    expect(r.data!.classes).toEqual([]);
  });

  it("returns the host's classes with course titles", async () => {
    // Return the host's classes only for the hostUserId-scoped query; the
    // stale-sweep's findMany (status:"live", no hostUserId) returns [].
    mFindManyClass.mockImplementation(((args: unknown) => {
      const where = (args as { where?: { hostUserId?: unknown } })?.where;
      if (where && where.hostUserId) return Promise.resolve([classRow()]);
      return Promise.resolve([]);
    }) as never);
    mFindManyCourse.mockResolvedValue([{ id: "course-1", title: "DSA" }] as never);
    const r = await listHostingClasses({ requesterId: HOST });
    expect(r.ok).toBe(true);
    expect(r.data!.classes[0].courseTitle).toBe("DSA");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getLiveClass
// ═════════════════════════════════════════════════════════════════════════════

describe("getLiveClass()", () => {
  it("404 when the class doesn't exist", async () => {
    mFindClass.mockResolvedValue(null as never);
    expect((await getLiveClass({ requesterId: HOST, liveClassId: "x" })).status).toBe(404);
  });

  it("403 when the requester has no access", async () => {
    mFindClass.mockResolvedValue(classRow() as never);
    mResolveJoin.mockResolvedValue({ allowed: false, role: "student" });
    expect((await getLiveClass({ requesterId: "out", liveClassId: "class-1" })).status).toBe(403);
  });

  it("returns the class DTO when allowed", async () => {
    mFindClass.mockResolvedValue(classRow() as never);
    mResolveJoin.mockResolvedValue({ allowed: true, role: "teacher" });
    const r = await getLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.id).toBe("class-1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// cancelLiveClass
// ═════════════════════════════════════════════════════════════════════════════

describe("cancelLiveClass()", () => {
  it("404 when the class doesn't exist", async () => {
    mFindClass.mockResolvedValue(null as never);
    expect((await cancelLiveClass({ requesterId: HOST, liveClassId: "x" })).status).toBe(404);
  });

  it("403 when requester is neither host nor instructor", async () => {
    mFindClass.mockResolvedValue(classRow({ hostUserId: "someone-else" }) as never);
    mIsInstructor.mockResolvedValue(false);
    expect((await cancelLiveClass({ requesterId: HOST, liveClassId: "class-1" })).status).toBe(403);
  });

  it("is idempotent when already cancelled", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "cancelled" }) as never);
    const r = await cancelLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(mUpdateClass).not.toHaveBeenCalled();
  });

  it("409 when the class is live", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "live" }) as never);
    expect((await cancelLiveClass({ requesterId: HOST, liveClassId: "class-1" })).status).toBe(409);
  });

  it("409 when the class already ended", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "ended" }) as never);
    expect((await cancelLiveClass({ requesterId: HOST, liveClassId: "class-1" })).status).toBe(409);
  });

  it("cancels a scheduled class", async () => {
    mFindClass.mockResolvedValue(classRow({ status: "scheduled" }) as never);
    mUpdateClass.mockResolvedValue(classRow({ status: "cancelled" }) as never);
    const r = await cancelLiveClass({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.status).toBe("cancelled");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// recordHostHeartbeat
// ═════════════════════════════════════════════════════════════════════════════

describe("recordHostHeartbeat()", () => {
  it("404 when the class doesn't exist", async () => {
    mFindClass.mockResolvedValue(null as never);
    expect((await recordHostHeartbeat({ requesterId: HOST, liveClassId: "x" })).status).toBe(404);
  });

  it("ok:false when the class is not live", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", hostUserId: HOST, courseId: "course-1", status: "scheduled" } as never);
    const r = await recordHostHeartbeat({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.ok).toBe(false);
    expect(mUpdateClass).not.toHaveBeenCalled();
  });

  it("ok:false when the requester is not the host / instructor", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", hostUserId: "other", courseId: "course-1", status: "live" } as never);
    mIsInstructor.mockResolvedValue(false);
    const r = await recordHostHeartbeat({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.data!.ok).toBe(false);
    expect(mUpdateClass).not.toHaveBeenCalled();
  });

  it("stamps hostLastSeenAt for the live host", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", hostUserId: HOST, courseId: "course-1", status: "live" } as never);
    mUpdateClass.mockResolvedValue({} as never);
    const r = await recordHostHeartbeat({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.data!.ok).toBe(true);
    expect(mUpdateClass).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hostLastSeenAt: expect.any(Date) }),
    }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listLiveParticipants (live roster — leftAt null only)
// ═════════════════════════════════════════════════════════════════════════════

describe("listLiveParticipants()", () => {
  it("404 when the class doesn't exist", async () => {
    mFindClass.mockResolvedValue(null as never);
    expect((await listLiveParticipants({ requesterId: HOST, liveClassId: "x" })).status).toBe(404);
  });

  it("403 when the requester has no access", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: HOST } as never);
    mResolveJoin.mockResolvedValue({ allowed: false, role: "student" });
    expect((await listLiveParticipants({ requesterId: "out", liveClassId: "class-1" })).status).toBe(403);
  });

  it("returns [] when no one is present", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: HOST } as never);
    mResolveJoin.mockResolvedValue({ allowed: true, role: "teacher" });
    mFindManyParticipant.mockResolvedValue([] as never);
    const r = await listLiveParticipants({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.participants).toEqual([]);
  });

  it("returns present participants with resolved names", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: HOST } as never);
    mResolveJoin.mockResolvedValue({ allowed: true, role: "teacher" });
    mFindManyParticipant.mockResolvedValue([
      { userId: "u-1", role: "student", joinedAt: new Date(), audioBlocked: false, videoBlocked: false, chatBlocked: false },
    ] as never);
    mUsers.mockResolvedValue([{ id: "u-1", name: "Student", avatarUrl: null }] as never);
    const r = await listLiveParticipants({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.data!.participants[0]).toMatchObject({ userId: "u-1", name: "Student", role: "student" });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listParticipants (attendance — host-only, everyone who ever joined)
// ═════════════════════════════════════════════════════════════════════════════

describe("listParticipants()", () => {
  it("404 when the class doesn't exist", async () => {
    mFindClass.mockResolvedValue(null as never);
    expect((await listParticipants({ requesterId: HOST, liveClassId: "x" })).status).toBe(404);
  });

  it("403 for a non-host / non-instructor", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: "other" } as never);
    mIsInstructor.mockResolvedValue(false);
    expect((await listParticipants({ requesterId: HOST, liveClassId: "class-1" })).status).toBe(403);
  });

  it("returns the full roster with name + email + present flag for the host", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: HOST } as never);
    mFindManyParticipant.mockResolvedValue([
      { userId: "u-1", role: "student", clientType: "STUDENT_DESKTOP", joinedAt: new Date(), leftAt: new Date() },
      { userId: HOST, role: "teacher", clientType: "TEACHER_DESKTOP", joinedAt: new Date(), leftAt: null },
    ] as never);
    mUsers.mockResolvedValue([
      { id: "u-1", name: "Student", email: "s@test.com" },
      { id: HOST, name: "Host", email: "h@test.com" },
    ] as never);
    const r = await listParticipants({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.participants).toHaveLength(2);
    const student = r.data!.participants.find((p) => p.userId === "u-1")!;
    expect(student).toMatchObject({ name: "Student", email: "s@test.com", present: false });
    const host = r.data!.participants.find((p) => p.userId === HOST)!;
    expect(host.present).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// listRecordings + listMyRecordings
// ═════════════════════════════════════════════════════════════════════════════

describe("listRecordings()", () => {
  it("404 when the class doesn't exist", async () => {
    mFindClass.mockResolvedValue(null as never);
    expect((await listRecordings({ requesterId: HOST, liveClassId: "x" })).status).toBe(404);
  });

  it("403 when the requester has no access", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: HOST } as never);
    mResolveJoin.mockResolvedValue({ allowed: false, role: "student" });
    expect((await listRecordings({ requesterId: "out", liveClassId: "class-1" })).status).toBe(403);
  });

  it("signs ready recordings and leaves processing ones unsigned", async () => {
    mFindClass.mockResolvedValue({ id: "class-1", courseId: "course-1", hostUserId: HOST } as never);
    mResolveJoin.mockResolvedValue({ allowed: true, role: "teacher" });
    mFindManyRec.mockResolvedValue([
      { id: "r-1", liveClassId: "class-1", status: "ready", duration: 60, createdAt: new Date(), s3Key: "live-recordings/c/r" },
      { id: "r-2", liveClassId: "class-1", status: "processing", duration: null, createdAt: new Date(), s3Key: "live-recordings/c/r2" },
    ] as never);
    const r = await listRecordings({ requesterId: HOST, liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    const recs = r.data!.recordings;
    expect(recs.find((x) => x.id === "r-1")!.url).toBe("https://cdn/signed.mp4");
    expect(recs.find((x) => x.id === "r-2")!.url).toBeNull();
  });
});

describe("listMyRecordings()", () => {
  it("returns [] when the user has no ended classes", async () => {
    mEnrolledCourseIds.mockResolvedValue([]);
    mFindManyClass.mockResolvedValue([] as never);
    const r = await listMyRecordings({ requesterId: "stu-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.courses).toEqual([]);
  });

  it("groups ready recordings as Course → Class → Recording", async () => {
    mEnrolledCourseIds.mockResolvedValue(["course-1"]);
    mFindManyClass.mockResolvedValue([
      { id: "class-1", courseId: "course-1", title: "Live 01", endedAt: new Date() },
    ] as never);
    mFindManyRec.mockResolvedValue([
      { id: "r-1", liveClassId: "class-1", status: "ready", duration: 60, createdAt: new Date(), s3Key: "live-recordings/c/r" },
    ] as never);
    mFindManyCourse.mockResolvedValue([{ id: "course-1", title: "Python" }] as never);
    const r = await listMyRecordings({ requesterId: "stu-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.courses).toHaveLength(1);
    expect(r.data!.courses[0].courseTitle).toBe("Python");
    expect(r.data!.courses[0].classes[0].recordings[0].url).toBe("https://cdn/signed.mp4");
  });
});
