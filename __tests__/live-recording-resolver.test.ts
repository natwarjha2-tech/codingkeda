/**
 * Unit tests — resolveRecordingObjectKey (app/lib/s3.ts)
 *
 * Which S3 object should a live-class recording play? Locks in:
 *  • the combined full-length file under final/ always wins over chunks;
 *  • a NEW-layout recording whose concatenation hasn't finished is "processing"
 *    (null) — never a ~5s chunk;
 *  • after a long grace with no final file we fall back to a chunk so the
 *    recording doesn't stay invisible forever;
 *  • legacy recordings (no capture/ folder) keep the old best-effort pick.
 *
 * S3 is mocked with an in-memory object listing — no real AWS calls.
 */

type Obj = { Key: string; Size: number; LastModified: Date };
let mockObjects: Obj[] = [];
const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  class Cmd {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: class {
      send(cmd: unknown) {
        return mockSend(cmd);
      }
    },
    ListObjectsV2Command: class ListObjectsV2Command extends Cmd {},
    PutObjectCommand: class extends Cmd {},
    GetObjectCommand: class extends Cmd {},
    DeleteObjectCommand: class extends Cmd {},
    DeleteObjectsCommand: class extends Cmd {},
  };
});
jest.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: jest.fn() }));

import { resolveRecordingObjectKey } from "@/app/lib/s3";

const ROOT = "live-recordings/class-1/rec-1";
const ago = (ms: number) => new Date(Date.now() - ms);
const obj = (Key: string, Size: number, age = 60_000): Obj => ({ Key, Size, LastModified: ago(age) });

beforeEach(() => {
  mockObjects = [];
  mockSend.mockReset();
  // Minimal ListObjectsV2: filter by Prefix, single page.
  mockSend.mockImplementation(async (cmd: { input: { Prefix?: string } }) => ({
    Contents: mockObjects.filter((o) => o.Key.startsWith(cmd.input.Prefix || "")),
    IsTruncated: false,
  }));
});

describe("resolveRecordingObjectKey()", () => {
  it("returns the combined final/ file, ignoring the small capture chunks", async () => {
    mockObjects = [
      obj(`${ROOT}/capture/composited-video/chunk-1.mp4`, 800_000),
      obj(`${ROOT}/capture/composited-video/chunk-2.mp4`, 900_000),
      obj(`${ROOT}/final/composited-video/concat-9.mp4`, 50_000_000),
    ];
    expect(await resolveRecordingObjectKey(ROOT)).toBe(`${ROOT}/final/composited-video/concat-9.mp4`);
  });

  it("prefers final/composited-video over another final/ mp4", async () => {
    mockObjects = [
      obj(`${ROOT}/final/audio/concat-9.mp4`, 90_000_000),
      obj(`${ROOT}/final/composited-video/concat-9.mp4`, 50_000_000),
    ];
    expect(await resolveRecordingObjectKey(ROOT)).toBe(`${ROOT}/final/composited-video/concat-9.mp4`);
  });

  it("is still PROCESSING (null) while concatenation hasn't produced final/ yet — never a 5s chunk", async () => {
    mockObjects = [
      obj(`${ROOT}/capture/composited-video/chunk-1.mp4`, 800_000, 60_000),
      obj(`${ROOT}/capture/composited-video/chunk-2.mp4`, 900_000, 30_000),
    ];
    expect(await resolveRecordingObjectKey(ROOT)).toBeNull();
  });

  it("falls back to the largest chunk if no final file ever appears (after the grace window)", async () => {
    const old = 2 * 60 * 60 * 1000; // 2h ago
    mockObjects = [
      obj(`${ROOT}/capture/composited-video/chunk-1.mp4`, 800_000, old),
      obj(`${ROOT}/capture/composited-video/chunk-2.mp4`, 900_000, old),
    ];
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(await resolveRecordingObjectKey(ROOT)).toBe(`${ROOT}/capture/composited-video/chunk-2.mp4`);
    warn.mockRestore();
  });

  it("legacy recordings (no capture/ folder) keep the best-effort pick: composited-video, else video/, else any mp4", async () => {
    const legacy = "live-recordings/class-1";
    mockObjects = [
      obj(`${legacy}/video/a.mp4`, 5_000_000),
      obj(`${legacy}/composited-video/b.mp4`, 1_000_000),
    ];
    expect(await resolveRecordingObjectKey(legacy)).toBe(`${legacy}/composited-video/b.mp4`);

    mockObjects = [obj(`${legacy}/video/a.mp4`, 1), obj(`${legacy}/video/b.mp4`, 9), obj(`${legacy}/x.mp4`, 99)];
    expect(await resolveRecordingObjectKey(legacy)).toBe(`${legacy}/video/b.mp4`);

    mockObjects = [obj(`${legacy}/x.mp4`, 1), obj(`${legacy}/y.mp4`, 7)];
    expect(await resolveRecordingObjectKey(legacy)).toBe(`${legacy}/y.mp4`);
  });

  it("returns null for an empty prefix / no objects / no mp4", async () => {
    expect(await resolveRecordingObjectKey("")).toBeNull();
    expect(await resolveRecordingObjectKey(ROOT)).toBeNull();
    mockObjects = [obj(`${ROOT}/capture/notes.txt`, 10)];
    expect(await resolveRecordingObjectKey(ROOT)).toBeNull();
  });

  it("accepts a prefix with a trailing slash", async () => {
    mockObjects = [obj(`${ROOT}/final/composited-video/c.mp4`, 10)];
    expect(await resolveRecordingObjectKey(`${ROOT}/`)).toBe(`${ROOT}/final/composited-video/c.mp4`);
  });

  it("never throws — an S3 error resolves to null", async () => {
    const err = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    expect(await resolveRecordingObjectKey(ROOT)).toBeNull();
    err.mockRestore();
  });
});
