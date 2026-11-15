/**
 * Unit tests — video processor safe exports (app/lib/video-processor.ts) [Phase 8]
 * The ffmpeg/S3 encode core is an integration concern (needs ffmpeg + real
 * disk), so we test the DETERMINISTIC, side-effect-free exports:
 *   • recordingHlsPrefix / recordingHlsMarkerKey — pure key builders
 *   • cancelVideoProcessing — no-op on empty id, safe when nothing is running
 *   • triggerVideoProcessing — no-op on empty id (fire-and-forget, queue-based)
 *   • processVideoById — returns {skipped} for an empty id (guard), and for a
 *     missing media row (encodeOne resolves to a non-throwing failure)
 *
 * FULLY MOCKED — prisma, s3, child_process, the notification creator and logger
 * are mocked. No ffmpeg, no AWS, no disk writes beyond the lib's own scratch-dir
 * mkdir (harmless). No real DB / network.
 */

process.env.AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "ck-bucket";

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    media: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("@/app/lib/s3", () => ({
  s3: { send: jest.fn() },
  getHlsMasterUrl: jest.fn((p: string) => `https://cdn/${p}/master.m3u8`),
}));
jest.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock("@/app/lib/notification", () => ({
  createNotification: jest.fn().mockResolvedValue({ id: "n1" }),
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import {
  recordingHlsPrefix,
  recordingHlsMarkerKey,
  cancelVideoProcessing,
  triggerVideoProcessing,
  processVideoById,
} from "@/app/lib/video-processor";
import { prisma } from "@/app/lib/prisma";

const mMediaFind = prisma.media.findUnique as jest.MockedFunction<typeof prisma.media.findUnique>;

describe("recording HLS key builders", () => {
  it("recordingHlsPrefix builds the live-<id> folder", () => {
    expect(recordingHlsPrefix("rec123")).toBe("hls/live-rec123");
  });

  it("recordingHlsMarkerKey appends ready.json under the prefix", () => {
    expect(recordingHlsMarkerKey("rec123")).toBe("hls/live-rec123/ready.json");
  });
});

describe("cancelVideoProcessing / triggerVideoProcessing", () => {
  it("cancelVideoProcessing is a safe no-op for an empty id", () => {
    expect(() => cancelVideoProcessing("")).not.toThrow();
  });

  it("cancelVideoProcessing is safe when the id isn't currently processing", () => {
    expect(() => cancelVideoProcessing("not-running-id")).not.toThrow();
  });

  it("triggerVideoProcessing is a safe no-op for an empty id", () => {
    expect(() => triggerVideoProcessing("")).not.toThrow();
  });
});

describe("processVideoById — guard paths", () => {
  it("returns {ok:true, skipped:true} for an empty id", async () => {
    const res = await processVideoById("");
    expect(res).toEqual({ ok: true, skipped: true });
  });

  it("does not throw and resolves a result object when media is missing", async () => {
    // encodeOne looks up the media; a missing row leads to a non-throwing
    // failure/skip result (the lib is designed to never throw).
    mMediaFind.mockResolvedValue(null as never);
    const res = await processVideoById("missing-media");
    expect(res).toHaveProperty("ok");
    expect(typeof res.ok).toBe("boolean");
  });
});
