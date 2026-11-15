/**
 * Unit tests — app/lib/live/recording-hls.ts
 *
 * S3 (client + listAllObjects) and the video-processor are fully mocked — no
 * real AWS, no ffmpeg, no DB. Covers HLS readiness + status, the replay
 * timeline parsing (chunk-name → ms, reaction decode, JSON extraction), and the
 * strictly-scoped delete (must refuse keys that aren't exactly this recording's
 * own folder — a safety-critical path).
 */

const mockS3Send = jest.fn();
const mockListAllObjects = jest.fn();

jest.mock("@/app/lib/s3", () => ({
  s3: { send: (cmd: unknown) => mockS3Send(cmd) },
  listAllObjects: (prefix: string) => mockListAllObjects(prefix),
}));

jest.mock("@/app/lib/video-processor", () => ({
  encodeRecordingToHls: jest.fn(),
  recordingHlsMarkerKey: (id: string) => `hls/live-${id}/ready.json`,
  recordingHlsPrefix: (id: string) => `hls/live-${id}`,
}));

// The AWS S3 command classes used directly by recording-hls — mocked so `new`
// just stores the input (we assert via the mocked s3.send / listAllObjects).
jest.mock("@aws-sdk/client-s3", () => {
  class Cmd { input: unknown; constructor(input: unknown) { this.input = input; } }
  return {
    HeadObjectCommand: class HeadObjectCommand extends Cmd {},
    GetObjectCommand: class GetObjectCommand extends Cmd {},
    DeleteObjectsCommand: class DeleteObjectsCommand extends Cmd {},
  };
});

import {
  isRecordingHlsReady,
  getRecordingHlsStatus,
  getRecordingTimeline,
  deleteRecordingMedia,
} from "@/app/lib/live/recording-hls";

const obj = (key: string, size = 10, modifiedAgoMs = 10 * 60 * 1000) =>
  ({ key, size, modified: Date.now() - modifiedAgoMs });

beforeEach(() => {
  mockS3Send.mockReset();
  mockListAllObjects.mockReset();
  mockListAllObjects.mockResolvedValue([]);
});

// ─── isRecordingHlsReady + getRecordingHlsStatus ──────────────────────────────

describe("isRecordingHlsReady() / getRecordingHlsStatus()", () => {
  it("returns true + caches 'ready' when the marker exists", async () => {
    mockS3Send.mockResolvedValue({}); // HeadObject succeeds → marker present
    const id = "rec-ready-1";
    expect(await isRecordingHlsReady(id)).toBe(true);
    expect(getRecordingHlsStatus(id)).toBe("ready");
  });

  it("returns false (and status 'pending') when the marker is missing", async () => {
    mockS3Send.mockRejectedValue(new Error("NotFound"));
    const id = "rec-missing-1";
    expect(await isRecordingHlsReady(id)).toBe(false);
    expect(getRecordingHlsStatus(id)).toBe("pending");
  });

  it("uses the ready cache on a second call (no second HEAD)", async () => {
    mockS3Send.mockResolvedValue({});
    const id = "rec-ready-2";
    await isRecordingHlsReady(id);
    mockS3Send.mockClear();
    expect(await isRecordingHlsReady(id)).toBe(true);
    expect(mockS3Send).not.toHaveBeenCalled(); // served from cache
  });

  it("uses the negative cache briefly after a miss (no repeat HEAD)", async () => {
    mockS3Send.mockRejectedValue(new Error("NotFound"));
    const id = "rec-neg-1";
    await isRecordingHlsReady(id);
    mockS3Send.mockClear();
    expect(await isRecordingHlsReady(id)).toBe(false);
    expect(mockS3Send).not.toHaveBeenCalled(); // negative cache hit
  });
});

// ─── getRecordingTimeline ─────────────────────────────────────────────────────

describe("getRecordingTimeline()", () => {
  it("returns empty timeline when s3Key is missing", async () => {
    const t = await getRecordingTimeline({ id: "x", s3Key: "" });
    expect(t).toEqual({ startMs: null, reactions: [] });
  });

  it("derives startMs from the earliest composited-video chunk name", async () => {
    mockListAllObjects.mockResolvedValue([
      obj("live-recordings/c/r/capture/composited-video/2026-11-11-16-17-10-000.mp4"),
      obj("live-recordings/c/r/capture/composited-video/2026-11-11-16-17-05-000.mp4"),
    ]);
    const t = await getRecordingTimeline({ id: "tl-1", s3Key: "live-recordings/c/r" });
    // earliest = 16:17:05 UTC on 2026-11-11
    expect(t.startMs).toBe(Date.UTC(2026, 10, 11, 16, 17, 5, 0));
    expect(t.reactions).toEqual([]);
  });

  it("parses floating reactions from data-channel files (JSON + base64)", async () => {
    mockListAllObjects.mockResolvedValue([
      obj("live-recordings/c/r/capture/composited-video/2026-11-11-16-00-00-000.mp4"),
      obj("live-recordings/c/r/capture/data-channel/2026-11-11-16-00-30-000.txt"),
    ]);
    const plain = JSON.stringify({ Topic: "ck-live-react", Data: JSON.stringify({ reaction: "👍" }), Timestamp: "2026-11-11T16:00:30.000Z" });
    const b64 = JSON.stringify({ Topic: "ck-live-react", Data: Buffer.from(JSON.stringify({ reaction: "🎉" })).toString("base64"), Timestamp: 1762876840 });
    mockS3Send.mockResolvedValue({ Body: { transformToString: async () => `${plain}\n${b64}` } });

    const t = await getRecordingTimeline({ id: "tl-2", s3Key: "live-recordings/c/r" });
    const emojis = t.reactions.map((r) => r.emoji);
    expect(emojis).toContain("👍");
    expect(emojis).toContain("🎉");
    // sorted ascending by atMs
    expect(t.reactions).toEqual([...t.reactions].sort((a, b) => a.atMs - b.atMs));
  });

  it("ignores non-reaction topics", async () => {
    mockListAllObjects.mockResolvedValue([
      obj("live-recordings/c/r/capture/data-channel/2026-11-11-16-00-30-000.txt"),
    ]);
    mockS3Send.mockResolvedValue({
      Body: { transformToString: async () => JSON.stringify({ Topic: "ck-live-chat", Data: JSON.stringify({ reaction: "👍" }), Timestamp: 1 }) },
    });
    const t = await getRecordingTimeline({ id: "tl-3", s3Key: "live-recordings/c/r" });
    expect(t.reactions).toEqual([]);
  });

  it("never throws — a listAllObjects failure yields an empty timeline", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockListAllObjects.mockRejectedValue(new Error("S3 down"));
    const t = await getRecordingTimeline({ id: "tl-4", s3Key: "live-recordings/c/r" });
    expect(t.startMs).toBeNull();
    errSpy.mockRestore();
  });
});

// ─── deleteRecordingMedia (safety-critical scoping) ───────────────────────────

describe("deleteRecordingMedia()", () => {
  it("returns {ok:false} for a missing id", async () => {
    const r = await deleteRecordingMedia({ id: "", s3Key: "k" });
    expect(r).toEqual({ ok: false, deleted: 0 });
  });

  it("deletes HLS output + the correctly-scoped raw folder", async () => {
    // Two listings: HLS prefix, then raw folder — each returns one object.
    mockListAllObjects
      .mockResolvedValueOnce([obj("hls/live-rec-1/seg0.ts")])
      .mockResolvedValueOnce([obj("live-recordings/class-1/rec-1/capture/x.mp4")]);
    mockS3Send.mockResolvedValue({});

    const r = await deleteRecordingMedia({ id: "rec-1", s3Key: "live-recordings/class-1/rec-1" });
    expect(r.ok).toBe(true);
    expect(r.deleted).toBe(2);
  });

  it("REFUSES to delete a raw key that is not exactly <class>/<recordingId> (scope guard)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    // HLS listing returns nothing; the raw key is a wrong shape → must be skipped.
    mockListAllObjects.mockResolvedValue([]);
    mockS3Send.mockResolvedValue({});

    const r = await deleteRecordingMedia({ id: "rec-2", s3Key: "live-recordings/some-other-folder" });
    expect(r.ok).toBe(true);
    // Only HLS prefix was listed (raw delete skipped), so nothing from raw.
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("REFUSES a raw key whose last segment != recordingId", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockListAllObjects.mockResolvedValue([]);
    mockS3Send.mockResolvedValue({});
    const r = await deleteRecordingMedia({ id: "rec-3", s3Key: "live-recordings/class-1/DIFFERENT-id" });
    expect(r.ok).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
