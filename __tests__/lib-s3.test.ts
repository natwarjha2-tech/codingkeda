/**
 * Unit tests — S3 / CloudFront helper lib (app/lib/s3.ts) [Phase 7, batch B]
 *   • getS3KeyFromUrl — S3 / CloudFront / invalid URL parsing
 *   • getPublicUrl / getHlsUrl / getHlsMasterUrl
 *   • isCloudFrontConfigured
 *   • signCloudFrontUrl / getCloudFrontSignedCookies  (real RSA signing, test key)
 *   • uploadToS3 / getSignedFileUrl / deleteFromS3 / deleteS3Prefix  (SDK mocked)
 *
 * FULLY MOCKED — the AWS SDK clients (S3 send, presigner) are mocked; CloudFront
 * signing uses a locally-generated throwaway RSA key. No real AWS call, no real
 * network, zero production side effects.
 */

import crypto from "crypto";

// Generate a throwaway RSA key pair for CloudFront signing tests.
const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
});

// ── Mock the AWS SDK BEFORE importing s3.ts ──────────────────────────────────
const mockSend = jest.fn();
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: (...a: unknown[]) => mockSend(...a) })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ __type: "Put", input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ __type: "Get", input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ __type: "Del", input })),
  ListObjectsV2Command: jest.fn().mockImplementation((input) => ({ __type: "List", input })),
  DeleteObjectsCommand: jest.fn().mockImplementation((input) => ({ __type: "DelBatch", input })),
}));

const mockGetSignedUrl = jest.fn();
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...a: unknown[]) => mockGetSignedUrl(...a),
}));

type S3Module = typeof import("@/app/lib/s3");

// Base AWS env is set persistently (s3.ts reads AWS_REGION at CALL time inside
// getPublicUrl, so it must remain set while the test runs — not just at import).
process.env.AWS_REGION = "ap-south-1";
process.env.AWS_ACCESS_KEY_ID = "AKIATEST";
process.env.AWS_SECRET_ACCESS_KEY = "secret";
process.env.AWS_S3_BUCKET_NAME = "ck-bucket";

/**
 * Load s3.ts with controlled CloudFront env (module reads CF_* at require time).
 * The CF env vars are left in place for the duration of the returned module's
 * use; each call clears them first so loads don't leak into one another.
 */
function loadS3(env: Record<string, string | undefined>): S3Module {
  delete process.env.CLOUDFRONT_DOMAIN;
  delete process.env.CLOUDFRONT_KEY_PAIR_ID;
  delete process.env.CLOUDFRONT_PRIVATE_KEY;
  Object.assign(process.env, env);
  let mod!: S3Module;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@/app/lib/s3");
  });
  return mod;
}

beforeEach(() => {
  mockSend.mockReset();
  mockGetSignedUrl.mockReset();
});

// ─────────────────────────────────────────────────────────────
// getS3KeyFromUrl
// ─────────────────────────────────────────────────────────────
describe("getS3KeyFromUrl", () => {
  const s3 = loadS3({});

  it("extracts the key from an S3 URL", () => {
    expect(s3.getS3KeyFromUrl("https://ck-bucket.s3.ap-south-1.amazonaws.com/videos/a.mp4"))
      .toBe("videos/a.mp4");
  });

  it("strips query params (signed-url params)", () => {
    expect(s3.getS3KeyFromUrl("https://ck-bucket.s3.ap-south-1.amazonaws.com/videos/a.mp4?X-Amz-Signature=abc"))
      .toBe("videos/a.mp4");
  });

  it("extracts the key from a CloudFront URL when configured", () => {
    const cf = loadS3({ CLOUDFRONT_DOMAIN: "d123.cloudfront.net" });
    expect(cf.getS3KeyFromUrl("https://d123.cloudfront.net/hls/x/master.m3u8"))
      .toBe("hls/x/master.m3u8");
  });

  it("returns null for an unrelated host", () => {
    expect(s3.getS3KeyFromUrl("https://evil.example/videos/a.mp4")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(s3.getS3KeyFromUrl("not a url")).toBeNull();
  });

  it("decodes percent-encoded keys", () => {
    expect(s3.getS3KeyFromUrl("https://ck-bucket.s3.ap-south-1.amazonaws.com/a%20b/c.pdf"))
      .toBe("a b/c.pdf");
  });
});

// ─────────────────────────────────────────────────────────────
// public url helpers
// ─────────────────────────────────────────────────────────────
describe("public url helpers", () => {
  it("getPublicUrl builds the S3 https url", () => {
    const s3 = loadS3({});
    expect(s3.getPublicUrl("videos/a.mp4")).toBe("https://ck-bucket.s3.ap-south-1.amazonaws.com/videos/a.mp4");
  });

  it("getHlsUrl uses CloudFront when configured, else S3", () => {
    expect(loadS3({ CLOUDFRONT_DOMAIN: "d1.cloudfront.net" }).getHlsUrl("hls/x/s.ts"))
      .toBe("https://d1.cloudfront.net/hls/x/s.ts");
    expect(loadS3({}).getHlsUrl("hls/x/s.ts"))
      .toBe("https://ck-bucket.s3.ap-south-1.amazonaws.com/hls/x/s.ts");
  });

  it("getHlsMasterUrl appends master.m3u8 and trims trailing slashes", () => {
    expect(loadS3({ CLOUDFRONT_DOMAIN: "d1.cloudfront.net" }).getHlsMasterUrl("hls/x/"))
      .toBe("https://d1.cloudfront.net/hls/x/master.m3u8");
  });
});

// ─────────────────────────────────────────────────────────────
// CloudFront configuration + signing
// ─────────────────────────────────────────────────────────────
describe("CloudFront signing", () => {
  const cfEnv = {
    CLOUDFRONT_DOMAIN: "d1.cloudfront.net",
    CLOUDFRONT_KEY_PAIR_ID: "KEYPAIR123",
    CLOUDFRONT_PRIVATE_KEY: privateKey,
  };

  it("isCloudFrontConfigured reflects env presence", () => {
    expect(loadS3({}).isCloudFrontConfigured()).toBe(false);
    expect(loadS3(cfEnv).isCloudFrontConfigured()).toBe(true);
  });

  it("signCloudFrontUrl produces a signed URL with Expires/Signature/Key-Pair-Id", () => {
    const url = loadS3(cfEnv).signCloudFrontUrl("videos/a.mp4", 600);
    expect(url).toContain("https://d1.cloudfront.net/videos/a.mp4");
    expect(url).toContain("Expires=");
    expect(url).toContain("Signature=");
    expect(url).toContain("Key-Pair-Id=KEYPAIR123");
  });

  it("getCloudFrontSignedCookies returns the three CF cookies", () => {
    const cookies = loadS3(cfEnv).getCloudFrontSignedCookies("hls/mediaX/", 600);
    expect(cookies).not.toBeNull();
    expect(cookies!["CloudFront-Key-Pair-Id"]).toBe("KEYPAIR123");
    expect(typeof cookies!["CloudFront-Policy"]).toBe("string");
    expect(typeof cookies!["CloudFront-Signature"]).toBe("string");
  });

  it("getCloudFrontSignedCookies returns null when CF not configured", () => {
    expect(loadS3({}).getCloudFrontSignedCookies("hls/x/")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// SDK-backed operations (send / presigner mocked)
// ─────────────────────────────────────────────────────────────
describe("S3 operations", () => {
  it("uploadToS3 sends a PutObject and returns the public URL", async () => {
    const s3 = loadS3({});
    mockSend.mockResolvedValue({});
    const url = await s3.uploadToS3(Buffer.from("x"), "videos/a.mp4", "video/mp4");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(url).toBe("https://ck-bucket.s3.ap-south-1.amazonaws.com/videos/a.mp4");
  });

  it("getSignedFileUrl delegates to the presigner", async () => {
    const s3 = loadS3({});
    mockGetSignedUrl.mockResolvedValue("https://signed.example/a.mp4");
    const url = await s3.getSignedFileUrl("videos/a.mp4", 120);
    expect(url).toBe("https://signed.example/a.mp4");
  });

  it("getSignedFileUrlFromUrl signs via S3 when CF not configured", async () => {
    const s3 = loadS3({});
    mockGetSignedUrl.mockResolvedValue("https://signed.example/a.mp4");
    const url = await s3.getSignedFileUrlFromUrl("https://ck-bucket.s3.ap-south-1.amazonaws.com/videos/a.mp4");
    expect(url).toBe("https://signed.example/a.mp4");
  });

  it("getSignedFileUrlFromUrl signs via CloudFront when configured", async () => {
    const s3 = loadS3({
      CLOUDFRONT_DOMAIN: "d1.cloudfront.net",
      CLOUDFRONT_KEY_PAIR_ID: "KP",
      CLOUDFRONT_PRIVATE_KEY: privateKey,
    });
    const url = await s3.getSignedFileUrlFromUrl("https://d1.cloudfront.net/videos/a.mp4");
    expect(url).toContain("Key-Pair-Id=KP");
  });

  it("getSignedFileUrlFromUrl throws for an invalid url", async () => {
    const s3 = loadS3({});
    await expect(s3.getSignedFileUrlFromUrl("not-a-url")).rejects.toThrow(/Invalid S3/);
  });

  it("deleteFromS3 returns true on success and false on failure", async () => {
    const s3 = loadS3({});
    mockSend.mockResolvedValueOnce({});
    expect(await s3.deleteFromS3("videos/a.mp4")).toBe(true);
    mockSend.mockRejectedValueOnce(new Error("boom"));
    expect(await s3.deleteFromS3("videos/b.mp4")).toBe(false);
  });

  it("deleteS3Prefix returns true when there is nothing to delete", async () => {
    const s3 = loadS3({});
    mockSend.mockResolvedValueOnce({ Contents: [] });
    expect(await s3.deleteS3Prefix("qualities/x/")).toBe(true);
  });

  it("deleteS3Prefix lists then batch-deletes objects", async () => {
    const s3 = loadS3({});
    mockSend
      .mockResolvedValueOnce({ Contents: [{ Key: "q/1.mp4" }, { Key: "q/2.mp4" }] }) // list
      .mockResolvedValueOnce({}); // delete batch
    expect(await s3.deleteS3Prefix("q/")).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("deleteS3Prefix returns false on a list/delete error", async () => {
    const s3 = loadS3({});
    mockSend.mockRejectedValueOnce(new Error("list failed"));
    expect(await s3.deleteS3Prefix("q/")).toBe(false);
  });
});
