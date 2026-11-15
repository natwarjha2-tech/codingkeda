/**
 * Unit tests — app/lib/live/chime.ts (Amazon Chime SDK Meetings wrapper)
 *
 * The AWS Chime SDK Meetings client is fully mocked — no real AWS, no network,
 * no DB. Covers meeting/attendee creation (incl. the "SDK returned nothing"
 * guards), get (found / not-found / rethrow), and delete (success / idempotent
 * not-found / rethrow).
 */

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-chime-sdk-meetings", () => {
  class Cmd {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  }
  return {
    ChimeSDKMeetingsClient: class {
      send(cmd: unknown) { return mockSend(cmd); }
    },
    CreateMeetingCommand: class CreateMeetingCommand extends Cmd {},
    CreateAttendeeCommand: class CreateAttendeeCommand extends Cmd {},
    DeleteMeetingCommand: class DeleteMeetingCommand extends Cmd {},
    GetMeetingCommand: class GetMeetingCommand extends Cmd {},
  };
});

jest.mock("@/app/lib/live/live-config", () => ({
  CHIME_CONTROL_REGION: "us-east-1",
  CHIME_MEDIA_REGION: "ap-south-1",
}));

import {
  createChimeMeeting,
  createChimeAttendee,
  getChimeMeeting,
  deleteChimeMeeting,
} from "@/app/lib/live/chime";

type Sent = { constructor: { name: string }; input: Record<string, unknown> };
const sent = (i = 0) => mockSend.mock.calls[i][0] as Sent;

const awsError = (name: string) => Object.assign(new Error(name), { name });

beforeEach(() => { mockSend.mockReset(); });

// ─── createChimeMeeting ───────────────────────────────────────────────────────

describe("createChimeMeeting()", () => {
  it("creates a meeting in the media region with an idempotency token", async () => {
    mockSend.mockResolvedValue({ Meeting: { MeetingId: "m-1" } });
    const m = await createChimeMeeting("class-1");

    expect(m).toEqual({ MeetingId: "m-1" });
    expect(sent().constructor.name).toBe("CreateMeetingCommand");
    expect(sent().input.ClientRequestToken).toBe("class-1");
    expect(sent().input.MediaRegion).toBe("ap-south-1");
    expect(sent().input.ExternalMeetingId).toBe("class-1");
  });

  it("truncates ExternalMeetingId to 64 chars", async () => {
    mockSend.mockResolvedValue({ Meeting: { MeetingId: "m-1" } });
    const long = "x".repeat(100);
    await createChimeMeeting(long);
    expect((sent().input.ExternalMeetingId as string).length).toBe(64);
  });

  it("throws when Chime returns no meeting id", async () => {
    mockSend.mockResolvedValue({ Meeting: {} });
    await expect(createChimeMeeting("class-1")).rejects.toThrow(/did not return a meeting/);
  });
});

// ─── createChimeAttendee ──────────────────────────────────────────────────────

describe("createChimeAttendee()", () => {
  it("creates an attendee for a meeting + user", async () => {
    mockSend.mockResolvedValue({ Attendee: { AttendeeId: "a-1", JoinToken: "tok" } });
    const a = await createChimeAttendee("m-1", "user-1");

    expect(a).toEqual({ AttendeeId: "a-1", JoinToken: "tok" });
    expect(sent().constructor.name).toBe("CreateAttendeeCommand");
    expect(sent().input.MeetingId).toBe("m-1");
    expect(sent().input.ExternalUserId).toBe("user-1");
  });

  it("throws when attendee id is missing", async () => {
    mockSend.mockResolvedValue({ Attendee: { JoinToken: "tok" } });
    await expect(createChimeAttendee("m-1", "u-1")).rejects.toThrow(/did not return an attendee/);
  });

  it("throws when join token is missing", async () => {
    mockSend.mockResolvedValue({ Attendee: { AttendeeId: "a-1" } });
    await expect(createChimeAttendee("m-1", "u-1")).rejects.toThrow(/did not return an attendee/);
  });
});

// ─── getChimeMeeting ──────────────────────────────────────────────────────────

describe("getChimeMeeting()", () => {
  it("returns null for an empty meeting id (no AWS call)", async () => {
    const m = await getChimeMeeting("");
    expect(m).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns the meeting when found", async () => {
    mockSend.mockResolvedValue({ Meeting: { MeetingId: "m-1" } });
    expect(await getChimeMeeting("m-1")).toEqual({ MeetingId: "m-1" });
  });

  it("returns null when the result has no meeting", async () => {
    mockSend.mockResolvedValue({});
    expect(await getChimeMeeting("m-1")).toBeNull();
  });

  it("returns null on NotFoundException", async () => {
    mockSend.mockRejectedValue(awsError("NotFoundException"));
    expect(await getChimeMeeting("m-1")).toBeNull();
  });

  it("returns null on ResourceNotFoundException", async () => {
    mockSend.mockRejectedValue(awsError("ResourceNotFoundException"));
    expect(await getChimeMeeting("m-1")).toBeNull();
  });

  it("rethrows any other AWS error", async () => {
    mockSend.mockRejectedValue(awsError("ThrottlingException"));
    await expect(getChimeMeeting("m-1")).rejects.toThrow("ThrottlingException");
  });
});

// ─── deleteChimeMeeting ───────────────────────────────────────────────────────

describe("deleteChimeMeeting()", () => {
  it("is a no-op for an empty id (no AWS call)", async () => {
    await deleteChimeMeeting("");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("deletes the meeting", async () => {
    mockSend.mockResolvedValue({});
    await deleteChimeMeeting("m-1");
    expect(sent().constructor.name).toBe("DeleteMeetingCommand");
    expect(sent().input.MeetingId).toBe("m-1");
  });

  it("swallows NotFoundException (idempotent)", async () => {
    mockSend.mockRejectedValue(awsError("NotFoundException"));
    await expect(deleteChimeMeeting("m-1")).resolves.toBeUndefined();
  });

  it("swallows ResourceNotFoundException (idempotent)", async () => {
    mockSend.mockRejectedValue(awsError("ResourceNotFoundException"));
    await expect(deleteChimeMeeting("m-1")).resolves.toBeUndefined();
  });

  it("rethrows other AWS errors", async () => {
    mockSend.mockRejectedValue(awsError("AccessDeniedException"));
    await expect(deleteChimeMeeting("m-1")).rejects.toThrow("AccessDeniedException");
  });
});
